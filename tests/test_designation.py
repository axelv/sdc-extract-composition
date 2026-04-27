"""Tests for the designation resolver layer."""

from __future__ import annotations

from typing import Any

import pytest

from fhir_liquid.designation import (
    CompositeResolver,
    ContainedSupplementResolver,
    DesignationRecord,
    TerminologyServerResolver,
    match_use,
)


SCT = "http://snomed.info/sct"
SCT_FSN = "900000000000003001"
SCT_SYN = "900000000000013009"
HL7_USAGE = "http://terminology.hl7.org/CodeSystem/designation-usage"


def _supplement(
    base_url: str,
    concepts: list[dict[str, Any]],
    *,
    url: str = "http://example.org/supplement",
) -> dict[str, Any]:
    return {
        "resourceType": "CodeSystem",
        "id": "supp",
        "url": url,
        "status": "active",
        "content": "supplement",
        "supplements": base_url,
        "concept": concepts,
    }


# --- match_use --------------------------------------------------------------


class TestMatchUse:
    def test_alias_matches_snomed_fsn_code(self):
        assert match_use(
            "fully-specified", {"system": SCT, "code": SCT_FSN}
        )

    def test_alias_matches_hl7_usage_code(self):
        # HL7 designation-usage uses textual codes, not magic numbers
        assert match_use(
            "fully-specified", {"system": HL7_USAGE, "code": "fully-specified"}
        )

    def test_alias_rejects_wrong_code(self):
        assert not match_use(
            "fully-specified", {"system": SCT, "code": SCT_SYN}
        )

    def test_canonical_system_pipe_code(self):
        assert match_use(
            f"{SCT}|{SCT_FSN}", {"system": SCT, "code": SCT_FSN}
        )

    def test_bare_code_matches_any_system(self):
        assert match_use(
            "preferredForLanguage",
            {"system": "http://elsewhere.example", "code": "preferredForLanguage"},
        )

    def test_no_use_only_matches_display_token(self):
        assert match_use("display", None)
        assert not match_use("fully-specified", None)


# --- ContainedSupplementResolver -------------------------------------------


class TestContainedSupplementResolver:
    def test_hit_returns_value(self):
        contained = [
            _supplement(
                SCT,
                [
                    {
                        "code": "109006",
                        "designation": [
                            {
                                "use": {"system": SCT, "code": SCT_FSN},
                                "value": "Concussion (disorder)",
                            }
                        ],
                    }
                ],
            )
        ]
        r = ContainedSupplementResolver(contained)
        assert (
            r.resolve(SCT, "109006", "fully-specified")
            == "Concussion (disorder)"
        )

    def test_miss_unknown_code_returns_none(self):
        r = ContainedSupplementResolver([_supplement(SCT, [])])
        assert r.resolve(SCT, "doesnotexist", "fully-specified") is None

    def test_miss_no_supplement_for_system(self):
        contained = [
            _supplement(
                SCT,
                [
                    {
                        "code": "109006",
                        "designation": [
                            {
                                "use": {"system": SCT, "code": SCT_FSN},
                                "value": "Concussion (disorder)",
                            }
                        ],
                    }
                ],
            )
        ]
        r = ContainedSupplementResolver(contained)
        assert (
            r.resolve("http://other.example", "109006", "fully-specified")
            is None
        )

    def test_multi_supplement_same_base_merges(self):
        contained = [
            _supplement(
                SCT,
                [
                    {
                        "code": "109006",
                        "designation": [
                            {
                                "use": {"system": SCT, "code": SCT_FSN},
                                "value": "Concussion (disorder)",
                            }
                        ],
                    }
                ],
                url="http://example.org/supp1",
            ),
            _supplement(
                SCT,
                [
                    {
                        "code": "109006",
                        "designation": [
                            {
                                "use": {"system": SCT, "code": SCT_SYN},
                                "value": "Brain concussion",
                            }
                        ],
                    }
                ],
                url="http://example.org/supp2",
            ),
        ]
        r = ContainedSupplementResolver(contained)
        assert r.resolve(SCT, "109006", "fully-specified") == "Concussion (disorder)"
        assert r.resolve(SCT, "109006", "synonym") == "Brain concussion"

    def test_no_contained_array(self):
        r = ContainedSupplementResolver(None)
        assert r.resolve(SCT, "109006", "fully-specified") is None

    def test_ignores_non_supplement_codesystems(self):
        contained = [
            {
                "resourceType": "CodeSystem",
                "url": "http://example.org/cs",
                "content": "complete",  # not a supplement
                "concept": [
                    {
                        "code": "x",
                        "designation": [
                            {
                                "use": {"system": SCT, "code": SCT_FSN},
                                "value": "should be ignored",
                            }
                        ],
                    }
                ],
            }
        ]
        r = ContainedSupplementResolver(contained)
        # No `supplements` link → never indexed
        assert r.resolve(SCT, "x", "fully-specified") is None

    def test_list_designations_returns_all(self):
        contained = [
            _supplement(
                SCT,
                [
                    {
                        "code": "109006",
                        "designation": [
                            {
                                "language": "en",
                                "use": {"system": SCT, "code": SCT_FSN},
                                "value": "Concussion (disorder)",
                            },
                            {
                                "language": "nl",
                                "use": {"system": SCT, "code": SCT_SYN},
                                "value": "Hersenschudding",
                            },
                        ],
                    }
                ],
            )
        ]
        r = ContainedSupplementResolver(contained)
        records = r.list_designations(SCT, "109006")
        assert len(records) == 2
        assert {rec.value for rec in records} == {
            "Concussion (disorder)",
            "Hersenschudding",
        }

    def test_language_pinning(self):
        contained = [
            _supplement(
                SCT,
                [
                    {
                        "code": "109006",
                        "designation": [
                            {
                                "language": "en",
                                "use": {"system": SCT, "code": SCT_SYN},
                                "value": "Brain concussion",
                            },
                            {
                                "language": "nl",
                                "use": {"system": SCT, "code": SCT_SYN},
                                "value": "Hersenschudding",
                            },
                        ],
                    }
                ],
            )
        ]
        r = ContainedSupplementResolver(contained)
        assert r.resolve(SCT, "109006", "synonym", "nl") == "Hersenschudding"
        assert r.resolve(SCT, "109006", "synonym", "en") == "Brain concussion"
        # No language preference → first match
        assert r.resolve(SCT, "109006", "synonym") == "Brain concussion"


# --- TerminologyServerResolver ---------------------------------------------


class _FakeHttp:
    def __init__(self, payload: dict[str, Any]):
        self.payload = payload
        self.calls: list[tuple[str, dict[str, str]]] = []

    def __call__(self, url: str, params: dict[str, str]) -> dict[str, Any]:
        self.calls.append((url, params))
        return self.payload


class TestTerminologyServerResolver:
    def test_parses_lookup_parameters_response(self):
        payload = {
            "resourceType": "Parameters",
            "parameter": [
                {"name": "name", "valueString": "SNOMED CT"},
                {
                    "name": "designation",
                    "part": [
                        {"name": "language", "valueCode": "en"},
                        {
                            "name": "use",
                            "valueCoding": {"system": SCT, "code": SCT_FSN},
                        },
                        {
                            "name": "value",
                            "valueString": "Concussion (disorder)",
                        },
                    ],
                },
                {
                    "name": "designation",
                    "part": [
                        {"name": "language", "valueCode": "nl"},
                        {
                            "name": "use",
                            "valueCoding": {"system": SCT, "code": SCT_SYN},
                        },
                        {"name": "value", "valueString": "Hersenschudding"},
                    ],
                },
            ],
        }
        http = _FakeHttp(payload)
        r = TerminologyServerResolver(
            "http://tx.example/fhir", http_get=http
        )
        assert (
            r.resolve(SCT, "109006", "fully-specified")
            == "Concussion (disorder)"
        )
        assert r.resolve(SCT, "109006", "synonym", "nl") == "Hersenschudding"

    def test_caches_per_system_code(self):
        payload = {
            "resourceType": "Parameters",
            "parameter": [
                {
                    "name": "designation",
                    "part": [
                        {
                            "name": "use",
                            "valueCoding": {"system": SCT, "code": SCT_FSN},
                        },
                        {"name": "value", "valueString": "FSN"},
                    ],
                }
            ],
        }
        http = _FakeHttp(payload)
        r = TerminologyServerResolver("http://tx.example/fhir", http_get=http)
        r.resolve(SCT, "109006", "fully-specified")
        r.resolve(SCT, "109006", "fully-specified")
        r.resolve(SCT, "109006", "synonym")  # different use, same (sys, code)
        assert len(http.calls) == 1

    def test_http_failure_returns_none_and_caches_empty(self):
        def boom(url: str, params: dict[str, str]) -> dict[str, Any]:
            raise RuntimeError("network down")

        r = TerminologyServerResolver("http://tx.example/fhir", http_get=boom)
        assert r.resolve(SCT, "109006", "fully-specified") is None
        # Subsequent call doesn't re-raise
        assert r.resolve(SCT, "109006", "fully-specified") is None

    def test_non_parameters_response_ignored(self):
        http = _FakeHttp({"resourceType": "OperationOutcome"})
        r = TerminologyServerResolver("http://tx.example/fhir", http_get=http)
        assert r.resolve(SCT, "109006", "fully-specified") is None

    def test_no_system_returns_none(self):
        http = _FakeHttp({"resourceType": "Parameters", "parameter": []})
        r = TerminologyServerResolver("http://tx.example/fhir", http_get=http)
        assert r.resolve(None, "x", "fully-specified") is None
        assert http.calls == []


# --- CompositeResolver -----------------------------------------------------


class _StubResolver:
    """Minimal in-memory resolver for composite ordering tests."""

    def __init__(self, table: dict[tuple[str, str, str], str]):
        self.table = table

    def resolve(self, system, code, use, language=None):
        return self.table.get((system, code, use))

    def list_designations(self, system, code):
        return [
            DesignationRecord(value=v, use_code=u)
            for (s, c, u), v in self.table.items()
            if s == system and c == code
        ]


class TestCompositeResolver:
    def test_first_hit_wins(self):
        first = _StubResolver({(SCT, "x", "fully-specified"): "from-first"})
        second = _StubResolver({(SCT, "x", "fully-specified"): "from-second"})
        composite = CompositeResolver([first, second])
        assert composite.resolve(SCT, "x", "fully-specified") == "from-first"

    def test_falls_through_to_next_on_miss(self):
        first = _StubResolver({})
        second = _StubResolver({(SCT, "x", "synonym"): "from-second"})
        composite = CompositeResolver([first, second])
        assert composite.resolve(SCT, "x", "synonym") == "from-second"

    def test_all_miss_returns_none(self):
        composite = CompositeResolver([_StubResolver({}), _StubResolver({})])
        assert composite.resolve(SCT, "x", "synonym") is None

    def test_list_designations_dedupes(self):
        first = _StubResolver({(SCT, "x", "fully-specified"): "FSN"})
        second = _StubResolver({(SCT, "x", "fully-specified"): "FSN"})
        composite = CompositeResolver([first, second])
        records = composite.list_designations(SCT, "x")
        assert len(records) == 1
