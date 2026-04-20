"""Tests for the composition renderer and Coding-aware equivalence override."""

import pytest

from viewer.backend.renderer import evaluate


@pytest.fixture()
def qr_with_bloedverdunners() -> dict:
    """Minimal QuestionnaireResponse with a coding answer for bloedverdunners."""
    return {
        "resourceType": "QuestionnaireResponse",
        "item": [
            {
                "linkId": "preop-an",
                "item": [
                    {
                        "linkId": "bloedverdunners",
                        "answer": [
                            {
                                "valueCoding": {
                                    "system": "http://snomed.info/sct",
                                    "code": "373067005",
                                    "display": "Nee",
                                }
                            }
                        ],
                    }
                ],
            }
        ],
    }


class TestPolymorphicValueAccessor:
    """The .value polymorphic accessor resolves valueCoding correctly."""

    def test_answer_value_from_root(self, qr_with_bloedverdunners: dict) -> None:
        """Direct path from root resolves .answer.value correctly."""
        result = evaluate(
            qr_with_bloedverdunners,
            "%resource.item.where(linkId='preop-an')"
            ".item.where(linkId='bloedverdunners').answer.value",
        )
        assert len(result) == 1
        assert result[0]["code"] == "373067005"

    def test_answer_value_in_where_context(self, qr_with_bloedverdunners: dict) -> None:
        """.answer.value inside .where() resolves the valueCoding."""
        result = evaluate(
            qr_with_bloedverdunners,
            "%resource.item.where(linkId='preop-an')"
            ".where(item.where(linkId='bloedverdunners').answer.value.exists())",
        )
        assert len(result) == 1


class TestCodingEquivalence:
    """Coding-aware ~ override compares code + system, ignoring display."""

    def test_equivalence_with_system(self, qr_with_bloedverdunners: dict) -> None:
        """Coding equivalence matches when both sides include system and code."""
        result = evaluate(
            qr_with_bloedverdunners,
            "%resource.item.where(linkId='preop-an')"
            ".item.where(linkId='bloedverdunners').answer.value"
            " ~ %factory.Coding('http://snomed.info/sct', '373067005')",
        )
        assert result == [True]

    def test_code_string_equality_works(self, qr_with_bloedverdunners: dict) -> None:
        """Comparing .value.code as a string works as a workaround."""
        result = evaluate(
            qr_with_bloedverdunners,
            "%resource.item.where(linkId='preop-an')"
            ".item.where(linkId='bloedverdunners').answer.value.code = '373067005'",
        )
        assert result == [True]


class TestConditionalSectionRendering:
    """End-to-end: conditional section suppression via .where().not()."""

    def test_bloedverdunners_nee_suppresses_section(self, qr_with_bloedverdunners: dict) -> None:
        """When bloedverdunners='Nee' (373067005), the .not() condition should exclude the section."""
        result = evaluate(
            qr_with_bloedverdunners,
            "%resource.item.where(linkId='preop-an')"
            ".where((item.where(linkId='bloedverdunners').answer.value"
            " ~ %factory.Coding('http://snomed.info/sct', '373067005')).not())",
        )
        assert result == []
