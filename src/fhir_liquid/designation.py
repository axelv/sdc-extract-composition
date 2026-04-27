"""Designation resolution for the ``|| designation: "..."`` filter.

A FHIR ``Coding`` carries a primary ``display`` but a concept can have many
alternative names: SNOMED fully-specified names, language-specific preferred
terms, custom synonyms. These live in ``CodeSystem.concept.designation``.

This module supplies two resolution sources, both FHIR-native:

- :class:`ContainedSupplementResolver` — reads ``CodeSystem`` resources with
  ``content == "supplement"`` from the Questionnaire's ``contained`` array.
- :class:`TerminologyServerResolver` — calls ``CodeSystem/$lookup`` and parses
  the ``Parameters`` response.

A :class:`CompositeResolver` chains them — first hit wins.

Both resolvers share a small alias table that maps clinician-friendly tokens
(``"fully-specified"``, ``"preferred"``, ``"synonym"``) to the
``designation.use.code`` values they can match. A canonical
``"<system>|<code>"`` form is also accepted as the use argument.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Protocol, runtime_checkable

__all__ = [
    "DesignationResolver",
    "DesignationRecord",
    "ContainedSupplementResolver",
    "TerminologyServerResolver",
    "CompositeResolver",
    "match_use",
    "USE_ALIASES",
]


# Alias → set of acceptable (system, code) pairs that the alias matches in
# CodeSystem.concept.designation.use. ``None`` for the system means "any
# system" (or no system set on the use Coding).
#
# Codes are taken from:
# - SNOMED CT designation types (http://snomed.info/sct):
#     900000000000003001  Fully specified name
#     900000000000013009  Synonym
#     900000000000548007  Preferred (acceptability — used as a use marker by
#                         many publishers)
# - HL7 designation-usage CodeSystem
#     (http://terminology.hl7.org/CodeSystem/designation-usage):
#     "preferredForLanguage", "fully-specified", "synonym", "display"
#
# The set form keeps the door open for adding more synonymous codes without
# changing the lookup logic.
USE_ALIASES: dict[str, frozenset[tuple[str | None, str]]] = {
    "fully-specified": frozenset(
        {
            ("http://snomed.info/sct", "900000000000003001"),
            (None, "fully-specified"),
        }
    ),
    "preferred": frozenset(
        {
            ("http://snomed.info/sct", "900000000000548007"),
            (None, "preferred"),
            (None, "preferredForLanguage"),
        }
    ),
    "synonym": frozenset(
        {
            ("http://snomed.info/sct", "900000000000013009"),
            (None, "synonym"),
        }
    ),
    "display": frozenset({(None, "display")}),
}


@dataclass(frozen=True)
class DesignationRecord:
    """One designation entry (use+language+value) for a coded concept."""

    value: str
    use_system: str | None = None
    use_code: str | None = None
    language: str | None = None


@runtime_checkable
class DesignationResolver(Protocol):
    """A pluggable source of designations for a given (system, code)."""

    def resolve(
        self,
        system: str | None,
        code: str,
        use: str,
        language: str | None = None,
    ) -> str | None:
        """Return the designation value matching ``use`` (and ``language``)."""

    def list_designations(
        self,
        system: str | None,
        code: str,
    ) -> list[DesignationRecord]:
        """Return all known designations for ``(system, code)``.

        Used by UI surfaces (e.g. SynonymsPanel) to populate a picker; not
        used by the filter on the rendering hot path.
        """


def match_use(
    use_arg: str,
    designation_use: dict[str, Any] | None,
) -> bool:
    """Return True if a designation's ``use`` matches the filter argument.

    ``use_arg`` may be:
    - an alias from :data:`USE_ALIASES` (``"fully-specified"``, ...);
    - a canonical ``"<system>|<code>"`` form for cases not in the table;
    - a bare code (matched against ``use.code`` regardless of system).

    A missing ``designation_use`` only matches the special token
    ``"display"``.
    """
    if designation_use is None:
        return use_arg == "display"

    use_code = designation_use.get("code")
    use_system = designation_use.get("system")

    if use_arg in USE_ALIASES:
        for sys_filter, code_filter in USE_ALIASES[use_arg]:
            if code_filter != use_code:
                continue
            if sys_filter is None or sys_filter == use_system:
                return True
        return False

    if "|" in use_arg:
        sys_filter, _, code_filter = use_arg.partition("|")
        return sys_filter == (use_system or "") and code_filter == (
            use_code or ""
        )

    return use_arg == use_code


def _records_from_concept(
    concept: dict[str, Any],
) -> list[DesignationRecord]:
    """Extract DesignationRecords from a CodeSystem.concept entry."""
    out: list[DesignationRecord] = []
    for des in concept.get("designation") or []:
        value = des.get("value")
        if not value:
            continue
        use = des.get("use") or {}
        out.append(
            DesignationRecord(
                value=value,
                use_system=use.get("system"),
                use_code=use.get("code"),
                language=des.get("language"),
            )
        )
    return out


def _select(
    records: Iterable[DesignationRecord],
    use: str,
    language: str | None,
) -> str | None:
    """First record whose use matches; language ties broken by preferring
    the requested language when set."""
    matching: list[DesignationRecord] = []
    for rec in records:
        use_obj = (
            None
            if rec.use_code is None and rec.use_system is None
            else {"system": rec.use_system, "code": rec.use_code}
        )
        if match_use(use, use_obj):
            matching.append(rec)
    if not matching:
        return None
    if language is not None:
        for rec in matching:
            if rec.language == language:
                return rec.value
    return matching[0].value


# --- contained supplements --------------------------------------------------


class ContainedSupplementResolver:
    """Resolve designations from contained CodeSystem supplements.

    A CodeSystem with ``content == "supplement"`` and a ``supplements`` URL
    pointing at the base CodeSystem can attach designations without restating
    the concept hierarchy. We index by ``(supplements_url, code) →
    [DesignationRecord, ...]``.

    Multiple supplements pointing at the same base are merged.
    """

    def __init__(self, contained: list[dict[str, Any]] | None) -> None:
        self._index: dict[tuple[str, str], list[DesignationRecord]] = {}
        if not contained:
            return
        for resource in contained:
            if (
                resource.get("resourceType") != "CodeSystem"
                or resource.get("content") != "supplement"
            ):
                continue
            base_url = resource.get("supplements")
            if not base_url:
                continue
            for concept in resource.get("concept") or []:
                code = concept.get("code")
                if not code:
                    continue
                key = (base_url, code)
                self._index.setdefault(key, []).extend(
                    _records_from_concept(concept)
                )

    def resolve(
        self,
        system: str | None,
        code: str,
        use: str,
        language: str | None = None,
    ) -> str | None:
        if not system:
            return None
        records = self._index.get((system, code))
        if not records:
            return None
        return _select(records, use, language)

    def list_designations(
        self,
        system: str | None,
        code: str,
    ) -> list[DesignationRecord]:
        if not system:
            return []
        return list(self._index.get((system, code), ()))


# --- terminology server -----------------------------------------------------


class TerminologyServerResolver:
    """Resolve designations via ``CodeSystem/$lookup``.

    Cached in-process by ``(system, code)`` for the lifetime of the resolver
    instance. The HTTP layer is injected so tests can stub it.
    """

    def __init__(
        self,
        base_url: str,
        *,
        http_get: Any | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._http_get = http_get or _default_http_get
        self._cache: dict[tuple[str, str], list[DesignationRecord]] = {}

    def resolve(
        self,
        system: str | None,
        code: str,
        use: str,
        language: str | None = None,
    ) -> str | None:
        if not system:
            return None
        records = self._fetch(system, code)
        if not records:
            return None
        return _select(records, use, language)

    def list_designations(
        self,
        system: str | None,
        code: str,
    ) -> list[DesignationRecord]:
        if not system:
            return []
        return list(self._fetch(system, code))

    def _fetch(self, system: str, code: str) -> list[DesignationRecord]:
        key = (system, code)
        if key in self._cache:
            return self._cache[key]
        url = f"{self._base_url}/CodeSystem/$lookup"
        params = {"system": system, "code": code, "property": "designation"}
        try:
            payload = self._http_get(url, params)
        except Exception:
            self._cache[key] = []
            return []
        records = _parse_lookup_parameters(payload)
        self._cache[key] = records
        return records


def _default_http_get(url: str, params: dict[str, str]) -> dict[str, Any]:
    """Lazy-import HTTP client so the dep is only needed when a tx server is
    actually configured."""
    import urllib.parse
    import urllib.request
    import json as _json

    qs = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{url}?{qs}",
        headers={"Accept": "application/fhir+json"},
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        return _json.loads(resp.read())


def _parse_lookup_parameters(
    payload: dict[str, Any],
) -> list[DesignationRecord]:
    """Pull DesignationRecords out of a CodeSystem/$lookup Parameters resp.

    The relevant slice looks like:
        {
          "resourceType": "Parameters",
          "parameter": [
            {"name": "designation", "part": [
              {"name": "language", "valueCode": "nl"},
              {"name": "use", "valueCoding": {"system": "...", "code": "..."}},
              {"name": "value", "valueString": "..."}
            ]},
            ...
          ]
        }
    """
    if payload.get("resourceType") != "Parameters":
        return []
    out: list[DesignationRecord] = []
    for param in payload.get("parameter") or []:
        if param.get("name") != "designation":
            continue
        language: str | None = None
        use_system: str | None = None
        use_code: str | None = None
        value: str | None = None
        for part in param.get("part") or []:
            pname = part.get("name")
            if pname == "language":
                language = part.get("valueCode")
            elif pname == "use":
                use = part.get("valueCoding") or {}
                use_system = use.get("system")
                use_code = use.get("code")
            elif pname == "value":
                value = part.get("valueString")
        if value:
            out.append(
                DesignationRecord(
                    value=value,
                    use_system=use_system,
                    use_code=use_code,
                    language=language,
                )
            )
    return out


# --- composite --------------------------------------------------------------


@dataclass
class CompositeResolver:
    """Try each resolver in order; first hit wins."""

    resolvers: list[DesignationResolver] = field(default_factory=list)

    def resolve(
        self,
        system: str | None,
        code: str,
        use: str,
        language: str | None = None,
    ) -> str | None:
        for r in self.resolvers:
            hit = r.resolve(system, code, use, language)
            if hit is not None:
                return hit
        return None

    def list_designations(
        self,
        system: str | None,
        code: str,
    ) -> list[DesignationRecord]:
        merged: list[DesignationRecord] = []
        seen: set[tuple[str | None, str | None, str | None, str]] = set()
        for r in self.resolvers:
            for rec in r.list_designations(system, code):
                key = (rec.use_system, rec.use_code, rec.language, rec.value)
                if key in seen:
                    continue
                seen.add(key)
                merged.append(rec)
        return merged
