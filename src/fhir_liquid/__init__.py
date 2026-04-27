"""FHIR Liquid templating with FHIRPath expression support.

This module provides FHIRPath expression evaluation within template strings,
enabling FHIR SDC template extraction patterns like:

    {{%context.item.where(linkId='hand').answer.value}}

The FHIRPath expressions use the following context variables:
- %context: The current focus element (resolved from base path)
- %resource: The root FHIR resource (e.g., the QuestionnaireResponse)

For partial structures, use a context dict with base path:
    context = {"base": "%resource.item.where(linkId='preop-an')", "resource": qr}

Example:
    >>> from fhir_liquid import render_template
    >>> qr = {"resourceType": "QuestionnaireResponse", "item": [...]}
    >>> context = {"base": "%resource.item.where(linkId='section1')", "resource": qr}
    >>> result = render_template(
    ...     "{{%context.item.where(linkId='field1').answer.value}}",
    ...     context
    ... )
"""

from __future__ import annotations

import re
from typing import Any, Required, TypedDict

import fhirpathpy
from fhirpathpy.models import models as fhir_models

from fhir_liquid.designation import DesignationResolver
from fhir_liquid.filters import FilterContext, apply_filters, split_filters

__all__ = [
    "render_template",
    "evaluate_fhirpath",
    "evaluate_fhirpath_list",
    "combine_expression",
    "FHIRContext",
    "DesignationResolver",
]

# Pattern to match FHIRPath expressions: {{ ... }}
# Uses non-greedy matching to handle multiple expressions
FHIRPATH_PATTERN = re.compile(r"\{\{(.+?)\}\}")

# Use R4 model for proper FHIR type resolution (including value[x] polymorphism)
R4_MODEL = fhir_models["r4"]

# Pattern for %factory.Coding('system', 'code') calls
_FACTORY_CODING_PATTERN = re.compile(
    r"%factory\.Coding\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)"
)


def _coding_equival(left: list, right: list) -> list:
    """Coding-aware ~ that compares code + system (when both present), ignoring display.

    fhirpathpy's default ~ does exact dict comparison, which fails when one
    side has extra fields like ``display``. FHIR equivalence semantics for
    Coding match on ``code`` + ``system`` (when both present) and ignore
    ``display``. Falls back to plain equality for non-Coding values.
    """
    if not left or not right:
        return [not left and not right]

    a, b = left[0], right[0]
    if isinstance(a, dict) and isinstance(b, dict) and "code" in a and "code" in b:
        if a["code"] != b["code"]:
            return [False]
        a_sys, b_sys = a.get("system"), b.get("system")
        if a_sys is not None and b_sys is not None and a_sys != b_sys:
            return [False]
        return [True]

    return [a == b]


def _coding_not_equival(left: list, right: list) -> list:
    """Negated Coding-aware ~ — mirrors ``(left ~ right).not()``.

    fhirpathpy's native ``!~`` does dict inequality, which spuriously reports
    codings as different when one side has fields the other doesn't (e.g. a
    QR's valueCoding carries ``display`` but the synthesized factory Coding
    doesn't). Reusing the ``~`` semantics keeps both operators consistent.
    """
    eq = _coding_equival(left, right)
    return [not v for v in eq]


_EVAL_OPTIONS = {
    "userInvocationTable": {
        "~": {"fn": _coding_equival, "arity": {2: ["Any", "Any"]}},
        "!~": {"fn": _coding_not_equival, "arity": {2: ["Any", "Any"]}},
    },
}


def _rewrite_factory_calls(expression: str) -> tuple[str, dict[str, Any]]:
    """Replace %factory.Coding(...) calls with synthetic context variables.

    Returns ``(rewritten_expression, extra_context_vars)``. The synthesized
    Codings include only the ``code`` field so ``~`` equivalence works even
    when the QR's valueCoding has no system (common with form-filler output).
    """
    extra_context: dict[str, Any] = {}
    counter = 0

    def replacer(match: re.Match[str]) -> str:
        nonlocal counter
        code = match.group(2)
        var_name = f"_coding_{counter}"
        counter += 1
        extra_context[var_name] = {"code": code}
        return f"%{var_name}"

    return _FACTORY_CODING_PATTERN.sub(replacer, expression), extra_context


class FHIRContext(TypedDict, total=False):
    """Context for FHIRPath evaluation with base path support."""

    base: Required[
        str
    ]  # FHIRPath expression for %context (e.g., "%resource.item.where(...)")
    resource: Required[dict[str, Any]]  # Root FHIR resource with resourceType


def combine_expression(base: str, expression: str) -> str:
    """Combine a base path with an expression by replacing %context.

    Replaces all occurrences of ``%context`` in the expression with
    the resolved base path.  When ``%context`` is followed by ``.``
    the dot is kept (e.g. ``%context.item`` → ``base.item``).
    A standalone ``%context`` is replaced with the bare base path.

    Args:
        base: The base FHIRPath (e.g., "%resource.item.where(linkId='x')")
        expression: Expression using %context (e.g., "%context.item.answer.value"
            or "iif(%context.item.exists(), 'a', 'b')")

    Returns:
        Combined expression with %context resolved.
    """
    if "%context" not in expression:
        return expression
    return expression.replace("%context", base)


def evaluate_fhirpath(
    expression: str,
    resource: dict[str, Any],
    base: str | None = None,
) -> Any:
    """Evaluate a FHIRPath expression against FHIR data.

    Args:
        expression: The FHIRPath expression to evaluate.
        resource: The root FHIR resource (must have resourceType for proper type resolution).
        base: Optional base path for %context. If provided, %context in expression
            is replaced with this base path, allowing full type resolution.

    Returns:
        The result of the FHIRPath evaluation. Returns empty string if no results,
        unwraps single-item lists.
    """
    # If base is provided, combine it with the expression
    if base:
        expression = combine_expression(base, expression)

    expression, extra = _rewrite_factory_calls(expression)
    # fhirpathpy expects context keys WITHOUT the % prefix
    fhir_context: dict[str, Any] = {"resource": resource, **extra}

    result = fhirpathpy.evaluate(
        resource, expression, fhir_context, R4_MODEL, _EVAL_OPTIONS
    )
    assert isinstance(result, list), "FHIRPath evaluation should return a list"

    if not result:
        return ""
    return result[0] if len(result) == 1 else result


def evaluate_fhirpath_list(
    expression: str,
    resource: dict[str, Any],
    base: str | None = None,
) -> list[Any]:
    """Evaluate a FHIRPath expression, always returning the raw list.

    Unlike evaluate_fhirpath, this never unwraps single-item lists or
    converts empty results to "". Useful for counting collection items.
    """
    if base:
        expression = combine_expression(base, expression)

    expression, extra = _rewrite_factory_calls(expression)
    fhir_context: dict[str, Any] = {"resource": resource, **extra}
    result = fhirpathpy.evaluate(
        resource, expression, fhir_context, R4_MODEL, _EVAL_OPTIONS
    )
    assert isinstance(result, list), "FHIRPath evaluation should return a list"
    return result


def _stringify(value: Any) -> str:
    """Convert a FHIRPath result to string for template output."""
    if value is None or value == "":
        return ""
    if isinstance(value, bool):
        return str(value).lower()
    if isinstance(value, list):
        return "".join(_stringify(item) for item in value)
    return str(value)


def render_template(
    template_source: str,
    context: FHIRContext,
    *,
    designation_resolver: DesignationResolver | None = None,
) -> str:
    """Render a template by evaluating {{ FHIRPath }} expressions.

    Args:
        template_source: The template string containing FHIRPath expressions
            in {{ ... }} delimiters.
        context: FHIRContext dict with:
            - resource: The root FHIR resource (required)
            - base: Optional FHIRPath for %context resolution
        designation_resolver: Optional resolver for the ``|| designation: ...``
            filter. When omitted, ``designation`` falls back to the Coding's
            own ``display`` value.

    Returns:
        The rendered template string with FHIRPath expressions evaluated.
    """
    resource = context["resource"]
    base = context.get("base")
    filter_ctx = (
        FilterContext(resolver=designation_resolver)
        if designation_resolver is not None
        else None
    )

    def replace_expression(match: re.Match[str]) -> str:
        head, filters = split_filters(match.group(1))
        result = evaluate_fhirpath(head, resource, base)
        if filters:
            result = apply_filters(result, filters, ctx=filter_ctx)
        return _stringify(result)

    return FHIRPATH_PATTERN.sub(replace_expression, template_source)
