"""Tests for the ``||`` filter pipeline in fhir_liquid."""

from __future__ import annotations

import pytest

from fhir_liquid import render_template
from fhir_liquid.filters import FilterInvocation, apply_filters, split_filters


# A minimal QuestionnaireResponse-shaped fixture.
@pytest.fixture
def qr() -> dict:
    return {
        "resourceType": "QuestionnaireResponse",
        "item": [
            {
                "linkId": "root",
                "item": [
                    {
                        "linkId": "name",
                        "answer": [{"valueString": "alice"}],
                    },
                    {
                        "linkId": "note",
                        "answer": [{"valueString": "**hello**"}],
                    },
                    {
                        "linkId": "code",
                        "answer": [{"valueString": "a|b"}],
                    },
                ],
            }
        ],
    }


# --- splitter ---------------------------------------------------------------


def test_splitter_no_filter():
    head, filters = split_filters(" %resource.id ")
    assert head == "%resource.id"
    assert filters == []


def test_splitter_single_filter():
    head, filters = split_filters("%resource.id || upcase")
    assert head == "%resource.id"
    assert [f.name for f in filters] == ["upcase"]


def test_splitter_chained_filters():
    head, filters = split_filters("%resource.id || downcase || prepend: 'x'")
    assert head == "%resource.id"
    assert [f.name for f in filters] == ["downcase", "prepend"]
    assert filters[1].args == ["x"]


def test_splitter_ignores_pipe_inside_quotes():
    # A single '|' inside a FHIRPath quoted literal must not be split.
    head, filters = split_filters("iif(x = 'a|b', 'yes', 'no')")
    assert head == "iif(x = 'a|b', 'yes', 'no')"
    assert filters == []


def test_splitter_ignores_double_pipe_inside_quotes():
    # '||' inside a quoted filter argument must not start a new filter.
    head, filters = split_filters("name || prepend: 'a || b '")
    assert head == "name"
    assert len(filters) == 1
    assert filters[0].args == ["a || b "]


def test_splitter_fhirpath_union_operator():
    # FHIRPath union '|' with no second '|' must be left alone.
    head, filters = split_filters("Patient.name | Patient.telecom")
    assert head == "Patient.name | Patient.telecom"
    assert filters == []


# --- apply_filters ----------------------------------------------------------


def test_apply_filters_unknown_raises():
    with pytest.raises(ValueError, match="bogus"):
        apply_filters("x", [FilterInvocation("bogus", [])])


# --- end-to-end render_template --------------------------------------------


def _ctx(qr: dict) -> dict:
    return {"resource": qr, "base": "%resource.item.where(linkId='root')"}


def test_render_no_filter_regression(qr):
    out = render_template(
        "{{ %context.item.where(linkId='name').answer.value }}",
        _ctx(qr),
    )
    assert out == "alice"


def test_render_single_filter(qr):
    out = render_template(
        "{{ %context.item.where(linkId='name').answer.value || upcase }}",
        _ctx(qr),
    )
    assert out == "ALICE"


def test_render_chained_filters(qr):
    out = render_template(
        "{{ %context.item.where(linkId='name').answer.value "
        "|| upcase || prepend: 'patient: ' }}",
        _ctx(qr),
    )
    assert out == "patient: ALICE"


def test_render_empty_result_through_filter(qr):
    out = render_template(
        "{{ %context.item.where(linkId='missing').answer.value || upcase }}",
        _ctx(qr),
    )
    assert out == ""


def test_render_fhirpath_literal_with_pipe_passes_through(qr):
    # The FHIRPath literal 'a|b' must round-trip via an .where() that matches it.
    out = render_template(
        "{{ %context.item.where(linkId='code').answer.value }}",
        _ctx(qr),
    )
    assert out == "a|b"


def test_render_markdownify(qr):
    out = render_template(
        "{{ %context.item.where(linkId='note').answer.value || markdownify }}",
        _ctx(qr),
    )
    assert "<strong>hello</strong>" in out


def test_render_unknown_filter_raises(qr):
    with pytest.raises(ValueError, match="bogus"):
        render_template(
            "{{ %context.item.where(linkId='name').answer.value || bogus }}",
            _ctx(qr),
        )


# --- default filter --------------------------------------------------------


def test_default_used_when_head_is_empty(qr):
    out = render_template(
        "{{ %context.item.where(linkId='missing').answer.value || default: '(none)' }}",
        _ctx(qr),
    )
    assert out == "(none)"


def test_default_passes_through_when_value_present(qr):
    out = render_template(
        "{{ %context.item.where(linkId='name').answer.value || default: '(none)' }}",
        _ctx(qr),
    )
    assert out == "alice"


def test_default_chains_with_subsequent_filters(qr):
    out = render_template(
        "{{ %context.item.where(linkId='missing').answer.value "
        "|| default: 'unknown' || upcase }}",
        _ctx(qr),
    )
    assert out == "UNKNOWN"


def test_default_preserves_boolean_false():
    qr_bool = {
        "resourceType": "QuestionnaireResponse",
        "item": [
            {
                "linkId": "root",
                "item": [
                    {"linkId": "flag", "answer": [{"valueBoolean": False}]},
                ],
            }
        ],
    }
    # FHIR treats `false` as a real value — the default must NOT kick in.
    out = render_template(
        "{{ %context.item.where(linkId='flag').answer.value || default: 'n/a' }}",
        {"resource": qr_bool, "base": "%resource.item.where(linkId='root')"},
    )
    assert out == "false"


# --- designation filter ----------------------------------------------------

from fhir_liquid.designation import ContainedSupplementResolver


SCT = "http://snomed.info/sct"
SCT_FSN = "900000000000003001"


@pytest.fixture
def coding_qr() -> dict:
    """A QR whose root section has one Coding-valued answer."""
    return {
        "resourceType": "QuestionnaireResponse",
        "item": [
            {
                "linkId": "root",
                "item": [
                    {
                        "linkId": "dx",
                        "answer": [
                            {
                                "valueCoding": {
                                    "system": SCT,
                                    "code": "109006",
                                    "display": "Concussion with brief loss of consciousness",
                                }
                            }
                        ],
                    },
                    {
                        "linkId": "dx-no-code",
                        "answer": [{"valueCoding": {"display": "no code"}}],
                    },
                ],
            }
        ],
    }


@pytest.fixture
def supplement_resolver() -> ContainedSupplementResolver:
    return ContainedSupplementResolver(
        [
            {
                "resourceType": "CodeSystem",
                "url": "http://example.org/sct-fsn",
                "status": "active",
                "content": "supplement",
                "supplements": SCT,
                "concept": [
                    {
                        "code": "109006",
                        "designation": [
                            {
                                "language": "en",
                                "use": {"system": SCT, "code": SCT_FSN},
                                "value": "Concussion with brief loss of consciousness (disorder)",
                            }
                        ],
                    }
                ],
            }
        ]
    )


def test_designation_resolves_fsn_from_supplement(coding_qr, supplement_resolver):
    out = render_template(
        "{{ %context.item.where(linkId='dx').answer.value || designation: \"fully-specified\" }}",
        _ctx(coding_qr),
        designation_resolver=supplement_resolver,
    )
    assert out == "Concussion with brief loss of consciousness (disorder)"


def test_designation_falls_back_to_display_when_no_match(coding_qr, supplement_resolver):
    # 'synonym' isn't in the supplement → fall back to Coding.display
    out = render_template(
        "{{ %context.item.where(linkId='dx').answer.value || designation: \"synonym\" }}",
        _ctx(coding_qr),
        designation_resolver=supplement_resolver,
    )
    assert out == "Concussion with brief loss of consciousness"


def test_designation_falls_back_when_no_resolver_configured(coding_qr):
    # No resolver → fall back to display
    out = render_template(
        "{{ %context.item.where(linkId='dx').answer.value || designation: \"fully-specified\" }}",
        _ctx(coding_qr),
    )
    assert out == "Concussion with brief loss of consciousness"


def test_designation_with_no_code_falls_back_to_display(coding_qr, supplement_resolver):
    out = render_template(
        "{{ %context.item.where(linkId='dx-no-code').answer.value || designation: \"fully-specified\" }}",
        _ctx(coding_qr),
        designation_resolver=supplement_resolver,
    )
    assert out == "no code"


def test_designation_chains_with_other_filters(coding_qr, supplement_resolver):
    out = render_template(
        "{{ %context.item.where(linkId='dx').answer.value "
        "|| designation: \"fully-specified\" || upcase }}",
        _ctx(coding_qr),
        designation_resolver=supplement_resolver,
    )
    assert out == "CONCUSSION WITH BRIEF LOSS OF CONSCIOUSNESS (DISORDER)"


def test_designation_on_codeable_concept(supplement_resolver):
    qr = {
        "resourceType": "QuestionnaireResponse",
        "item": [
            {
                "linkId": "root",
                "item": [
                    {
                        "linkId": "dx",
                        "answer": [
                            {
                                "valueCodeableConcept": {
                                    "coding": [
                                        {
                                            "system": SCT,
                                            "code": "109006",
                                            "display": "Concussion",
                                        }
                                    ],
                                    "text": "concussion",
                                }
                            }
                        ],
                    }
                ],
            }
        ],
    }
    # fhirpathpy's R4 model doesn't unfold .value → valueCodeableConcept,
    # so use the direct accessor — this is the recommended pattern when
    # authors know the answer type is CodeableConcept.
    out = render_template(
        "{{ %context.item.where(linkId='dx').answer.valueCodeableConcept "
        "|| designation: \"fully-specified\" }}",
        {"resource": qr, "base": "%resource.item.where(linkId='root')"},
        designation_resolver=supplement_resolver,
    )
    assert out == "Concussion with brief loss of consciousness (disorder)"


def test_existing_filters_unaffected_by_resolver(qr, supplement_resolver):
    # Sanity: passing a resolver doesn't change non-designation filters.
    out = render_template(
        "{{ %context.item.where(linkId='name').answer.value || upcase }}",
        _ctx(qr),
        designation_resolver=supplement_resolver,
    )
    assert out == "ALICE"
