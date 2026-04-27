#!/usr/bin/env python3
"""Generate the Composition template for inspanningstest text generation.

Encodes the conditional logic from Inspanningstest_tekstgeneratie.docx as
templateExtractContext FHIRPath expressions.

Usage:
    python generate_composition.py
    # Generates questionnaire-extract.json in the same directory
"""

from __future__ import annotations

import json
from typing import Any

CONTEXT_URL = (
    "http://hl7.org/fhir/uv/sdc/StructureDefinition/"
    "sdc-questionnaire-templateExtractContext"
)

# -- Code systems -------------------------------------------------------------
SCT = "http://snomed.info/sct"
TIRO = (
    "http://templates.tiro.health/templates/"
    "e609837ea4d849b394fba5e84bfab624/custom-codes"
)

JA = "373066001"
NEE = "373067005"

# -- Questionnaire link IDs ---------------------------------------------------
ROOT = "019c4706-3d88-799c-8767-fed5898075e1"

PROT_GROUP = "019cadf7-0fe6-7aa7-97ae-bfb0dff20e15"
SOORT_PROT = "019cae04-716c-7aa7-9964-e193ddec2553"
STAPSGEWIJZE = "019cae06-4d63-7aa7-9977-6b19b8fcda3c"
RAMP = "019cae06-93ea-7aa7-9978-21eacda189a5"
START_W = "019c4706-3fe6-799c-8768-c3b0a8a4738c"
STIJG = "019c470a-ab62-799c-87be-08a3df69201b"
PER = "019c4711-bd82-799c-87e1-a44056478612"

INSP_GROUP = "019d1f04-a852-7330-8782-9df409bbe060"
DUUR = "019c4722-e62a-799c-89e3-2c97936302a0"
SECONDEN = "019d2e97-3144-7bbf-aee2-c6efd27ea4e9"
PIEK = "019c4722-fbce-799c-89ea-66b34dcaa3ac"
REDEN = "019c47f8-7000-799c-91c6-78452dea92e8"

BD_GROUP = "019cae00-ccb5-7aa7-98d8-d36646c999be"
BD_SYST = "019c4781-6e9b-799c-8b9b-34802222313f"
BD_DIAST = "019c4783-92fe-799c-8bf0-bb4495251181"

HR_GROUP = "019db547-c962-7009-8baf-e510f6db2569"
HR_MAX = "019db547-cba8-7009-8bb0-07b539cf1857"
HR_PCT = "019db547-cba8-7009-8bb0-156a90a26a89"
HR_INTERP = "019c6b40-3452-777a-be3a-dd349ad2c387"

REPOL = "019c4793-d723-799c-8c94-cd1b531f9db7"
GEEN_WIJZIGINGEN = "019c4798-d1de-799c-8ccc-811b82b62467"
J_PUNT = "019c47ab-3c28-799c-8d6e-f1ea6006833d"
ST_WIJZIGING = "019c47aa-f82c-799c-8d6d-8c7686e1a858"
NIET_TE_BEOORDELEN = "019cd6d9-59b6-7000-80f2-46c15fbb9d0e"

NIET_BEOORDELEN_REDEN = "019c479b-b403-799c-8ce4-9701188c1cc8"
ST_GROUP = "019d1f6c-3076-722f-aa97-873d56c4a093"
ST_SOORT = "019c47a7-9ae4-799c-8d54-c67b61699b73"
ST_MAX = "019c47ac-8b40-799c-8d81-c6b0c5d27d87"
ST_SLOPE = "019c6b54-0b22-777a-be95-745085be605a"
ST_AFLEIDINGEN = "019c47ae-0724-799c-8d96-534c9cf7391f"
ST_INTERPRETATIE = "019c8ef4-5c19-799c-a485-bd9b43e4137d"

RITME_GROUP = "019d1efe-6153-7330-86ec-e8360dcc5883"
RITME = "019c47c6-92ae-799c-900c-0a0c2a9fbbf0"
RITME_GEEN = "373067005"
RITME_VES = "251176006"
RITME_AV = "233917008"
VES_SPEC = "019c47d4-d820-799c-90ab-40eefcca48dc"
AV_SPEC = "019cd74e-0653-7000-82fa-853daf5dd419"

REDEN_VERMOEIDHEID = "84229001"
REDEN_RETROSTERNALE_PIJN = "4568003"

BESLUIT = "019daeed-d5cf-7aa5-ae7a-55f29782be60"

TYPE_GROUP = "019d3db2-e0c4-7fff-854c-95b40a1d03e7"
REGADENOSON = "019cae08-1c3a-7aa7-99b8-b65a55f18c29"
LIGFIETS = "019d3dae-17e0-7fff-84fb-868b50067657"

# -- Helpers ------------------------------------------------------------------


def coding(system: str, code: str) -> str:
    return f"%factory.Coding('{system}', '{code}')"


def div(html: str) -> dict[str, Any]:
    return {
        "status": "generated",
        "div": f'<div xmlns="http://www.w3.org/1999/xhtml">{html}</div>',
    }


def sec(
    *,
    title: str | None = None,
    context: str | None = None,
    text: str = "",
    children: list[dict] | None = None,
) -> dict[str, Any]:
    s: dict[str, Any] = {}
    if context:
        s["extension"] = [{"url": CONTEXT_URL, "valueString": context}]
    if title:
        s["title"] = title
    if text:
        s["text"] = div(text)
    if children:
        s["section"] = children
    return s


def ctx_where(predicate: str) -> str:
    return f"%context.where({predicate})"


# Path through a sub-group: %context.item.where(linkId='GROUP').item.where(linkId='LID').answer.value
def grp(group: str, link_id: str, prop: str = "") -> str:
    s = f".{prop}" if prop else ""
    return (
        "{{%context.item.where(linkId='" + group + "').item.where(linkId='"
        + link_id + "').answer.value" + s + "}}"
    )


def fld(link_id: str, prop: str = "") -> str:
    s = f".{prop}" if prop else ""
    return "{{%context.item.where(linkId='" + link_id + "').answer.value" + s + "}}"


# Path to choice value (without {{ }}) for use in iif/where predicates
def grp_path(group: str, link_id: str, prop: str = "") -> str:
    s = f".{prop}" if prop else ""
    return (
        "item.where(linkId='" + group + "').item.where(linkId='"
        + link_id + "').answer.value" + s
    )


def fld_path(link_id: str, prop: str = "") -> str:
    s = f".{prop}" if prop else ""
    return "item.where(linkId='" + link_id + "').answer.value" + s


# -- Section builders ---------------------------------------------------------

REGAD_VAL = grp_path(TYPE_GROUP, REGADENOSON)
LIG_VAL = grp_path(TYPE_GROUP, LIGFIETS)


def build_intro() -> dict:
    """Section 1 — Inspanningstest type sentence."""
    return sec(
        title="Inspanningstest",
        context=f"%resource.item.where(linkId='{ROOT}')",
        text="<p>Inspanningstest <!-- sections --></p>",
        children=[
            sec(
                context=ctx_where(f"{REGAD_VAL} ~ {coding(SCT, JA)}"),
                text="met behulp van een regadenoson stress test.",
            ),
            sec(
                context=ctx_where(
                    f"{REGAD_VAL} !~ {coding(SCT, JA)} "
                    f"and {LIG_VAL} ~ {coding(SCT, JA)}"
                ),
                text="op een ligfiets.",
            ),
            sec(
                context=ctx_where(
                    f"{REGAD_VAL} !~ {coding(SCT, JA)} "
                    f"and {LIG_VAL} !~ {coding(SCT, JA)}"
                ),
                text="op fiets.",
            ),
        ],
    )


def build_protocol() -> dict:
    """Section 2 — Protocol details (only when not regadenoson)."""
    soort_iif = (
        "{{iif(%context.item.where(linkId='" + SOORT_PROT
        + "').answer.value ~ " + coding(TIRO, STAPSGEWIJZE)
        + ", 'stapsgewijze', 'geleidelijke')}}"
    )
    return sec(
        title="Protocol",
        context=(
            f"%resource.item.where(linkId='{ROOT}')"
            f".where({REGAD_VAL} !~ {coding(SCT, JA)})"
            f".item.where(linkId='{PROT_GROUP}')"
        ),
        text=(
            f"<p>Start aan {fld(START_W)} W met een {soort_iif} stijging "
            f"van {fld(STIJG)} W per {fld(PER)} minuten.</p>"
        ),
    )


def build_inspanning() -> dict:
    """Section 3 — Inspanning duur + reden van stoppen (only when not regadenoson)."""
    return sec(
        title="Inspanning",
        context=(
            f"%resource.item.where(linkId='{ROOT}')"
            f".where({REGAD_VAL} !~ {coding(SCT, JA)})"
            f".item.where(linkId='{INSP_GROUP}')"
        ),
        text=(
            f"<p>Inspanning van {fld(DUUR)} minuten en {fld(SECONDEN)} "
            f"seconden met een piekbelasting van {fld(PIEK)} W.</p>"
            "<p>Reden voor stoppen van de test: "
            "{{%context.item.where(linkId='" + REDEN
            + "').answer.value.display || join: ', '}}.</p>"
        ),
    )


def build_bloeddruk_hartslag() -> dict:
    """Section 4 — Maximale bloeddruk + maximale hartslag."""
    syst = grp(BD_GROUP, BD_SYST)
    diast = grp(BD_GROUP, BD_DIAST)
    hr_max = grp(HR_GROUP, HR_MAX)
    hr_pct = grp(HR_GROUP, HR_PCT)
    hr_interp_path = grp_path(HR_GROUP, HR_INTERP)
    hr_interp_disp = grp_path(HR_GROUP, HR_INTERP, "display")

    # If interpretatie is set → ", {interpretatie}"; else → " ({pct}% van verwachtte maximum)"
    suffix = (
        "{{iif(%context." + hr_interp_path + ".exists(), "
        "', ' + %context." + hr_interp_disp + ", "
        "' (' + %context." + grp_path(HR_GROUP, HR_PCT) + ".toString() + '% van verwachtte maximum)'"
        ")}}"
    )
    # Fall back to plain pct if toString() not supported by the engine.
    return sec(
        title="Bloeddruk en hartslag",
        context=f"%resource.item.where(linkId='{ROOT}')",
        text=(
            f"<p>Maximale bloeddruk: {syst}/{diast} mmHg "
            f"en maximale hartslag: {hr_max}{suffix}.</p>"
        ),
    )


def build_repolarisatie() -> dict:
    """Section 5 — Repolarisatie (4 mutually-exclusive branches)."""
    repol_val = fld_path(REPOL)
    # Within ST wijziging branch: descend into answer.item.{ST_GROUP}
    st_inside = (
        f"item.where(linkId='{REPOL}').answer.item.where(linkId='{ST_GROUP}')"
    )
    st_soort_disp = (
        "{{%context." + st_inside + ".item.where(linkId='" + ST_SOORT
        + "').answer.value.display}}"
    )
    st_max = (
        "{{%context." + st_inside + ".item.where(linkId='" + ST_MAX
        + "').answer.value}}"
    )
    st_slope = (
        "{{%context." + st_inside + ".item.where(linkId='" + ST_SLOPE
        + "').answer.value.display}}"
    )
    st_afl = (
        "{{%context." + st_inside + ".item.where(linkId='" + ST_AFLEIDINGEN
        + "').answer.value.display || join: ', '}}"
    )
    st_interp = (
        "{{%context." + st_inside + ".item.where(linkId='" + ST_INTERPRETATIE
        + "').answer.value.display}}"
    )

    # Niet te beoordelen door (sibling sub-item under Repolarisatie's answer.item)
    niet_inside = (
        f"item.where(linkId='{REPOL}').answer.item.where(linkId='{NIET_BEOORDELEN_REDEN}')"
    )
    niet_disp = (
        "{{%context." + niet_inside + ".answer.value.display || join: ', '}}"
    )

    return sec(
        title="Repolarisatie",
        context=f"%resource.item.where(linkId='{ROOT}')",
        text="<!-- sections -->",
        children=[
            sec(
                context=ctx_where(f"{repol_val} ~ {coding(TIRO, GEEN_WIJZIGINGEN)}"),
                text="<p>Repolarisatie: geen significante wijzigingen.</p>",
            ),
            sec(
                context=ctx_where(f"{repol_val} ~ {coding(TIRO, J_PUNT)}"),
                text="<p>Repolarisatie: J punt daling.</p>",
            ),
            sec(
                context=ctx_where(f"{repol_val} ~ {coding(TIRO, ST_WIJZIGING)}"),
                text=(
                    "<p>Repolarisatie: ST wijziging.</p>"
                    f"<p>{st_interp} {st_soort_disp} van {st_max} mm "
                    f"({st_slope} segment) in afleidingen: {st_afl}.</p>"
                ),
            ),
            sec(
                context=ctx_where(f"{repol_val} ~ {coding(TIRO, NIET_TE_BEOORDELEN)}"),
                text=f"<p>Repolarisatie: niet te beoordelen door {niet_disp}.</p>",
            ),
        ],
    )


def build_ritmestoornissen() -> dict:
    """Section 6 — Ritmestoornissen with conditional VES/AV-blok specifics.

    Each branch uses ``value.where($this ~ Coding).exists()`` so multi-select
    answers (e.g., [VES, AV-blok]) trigger every applicable branch instead of
    only the one matching the first selected coding.
    """
    ritme_val = grp_path(RITME_GROUP, RITME)

    has_geen = f"{ritme_val}.where($this ~ {coding(SCT, RITME_GEEN)}).exists()"
    has_ves = f"{ritme_val}.where($this ~ {coding(SCT, RITME_VES)}).exists()"
    has_av = f"{ritme_val}.where($this ~ {coding(SCT, RITME_AV)}).exists()"

    # All selections excluding geen / VES / AV-blok — these get a plain list line.
    other_items = (
        f"{ritme_val}.where("
        f"$this !~ {coding(SCT, RITME_GEEN)} "
        f"and $this !~ {coding(SCT, RITME_VES)} "
        f"and $this !~ {coding(SCT, RITME_AV)})"
    )
    has_other = f"{other_items}.exists()"

    # When VES selected: descend into that answer's nested specs
    ves_inside = (
        f"item.where(linkId='{RITME_GROUP}').item.where(linkId='{RITME}')"
        f".answer.where(value ~ {coding(SCT, RITME_VES)}).item.where(linkId='{VES_SPEC}')"
    )
    av_inside = (
        f"item.where(linkId='{RITME_GROUP}').item.where(linkId='{RITME}')"
        f".answer.where(value ~ {coding(SCT, RITME_AV)}).item.where(linkId='{AV_SPEC}')"
    )

    ves_specs_join = (
        "{{%context." + ves_inside + ".answer.value.display || join: ', '}}"
    )
    av_specs_join = (
        "{{%context." + av_inside + ".answer.value.display || join: ', '}}"
    )
    other_disp = (
        "{{%context." + other_items + ".display || join: ', '}}"
    )

    return sec(
        title="Ritmestoornissen",
        context=f"%resource.item.where(linkId='{ROOT}')",
        text="<!-- sections -->",
        children=[
            # "Geen" alone — fires only when no other ritmestoornis was selected.
            sec(
                context=ctx_where(
                    f"{has_geen} and {has_ves}.not() and {has_av}.not() "
                    f"and {has_other}.not()"
                ),
                text="<p>Geen ritmestoornissen.</p>",
            ),
            # Plain list of other items (non-special selections).
            sec(
                context=ctx_where(has_other),
                text=f"<p>Ritmestoornissen: {other_disp}.</p>",
            ),
            # VES branch — independent; fires whenever VES is among selections.
            sec(
                context=ctx_where(has_ves),
                text=f"<p>Ventriculaire extrasystolen ({ves_specs_join}).</p>",
            ),
            # AV-blok branch — independent; fires whenever AV-blok is selected.
            sec(
                context=ctx_where(has_av),
                text=f"<p>AV-blok: {av_specs_join}.</p>",
            ),
        ],
    )


def build_besluit() -> dict:
    """Section 7 — Besluit (auto-text where conditions match, else free-text)."""
    repol_val = fld_path(REPOL)
    reden_val = grp_path(INSP_GROUP, REDEN)
    ritme_val = grp_path(RITME_GROUP, RITME)

    # Conditions — multi-select answers (reden, ritme) use .where().exists()
    # so the predicate matches when the target coding appears anywhere in the
    # selection rather than only when it's the first item.
    neg = (
        f"{ritme_val}.count() = 1 "
        f"and {ritme_val}.where($this ~ {coding(SCT, RITME_GEEN)}).exists() "
        f"and {reden_val}.count() = 1 "
        f"and {reden_val}.where($this ~ {coding(SCT, REDEN_VERMOEIDHEID)}).exists() "
        f"and {repol_val} ~ {coding(TIRO, GEEN_WIJZIGINGEN)}"
    )
    afw = (
        f"{reden_val}.where($this ~ {coding(SCT, REDEN_RETROSTERNALE_PIJN)}).exists() "
        f"and {repol_val} ~ {coding(TIRO, ST_WIJZIGING)}"
    )

    return sec(
        title="Samenvattend besluit",
        context=f"%resource.item.where(linkId='{ROOT}')",
        text="<!-- sections -->",
        children=[
            sec(
                context=ctx_where(neg),
                text=(
                    "<p>Klinisch en elektrocardiografisch negatieve "
                    "inspanningstest zonder ritmestoornissen.</p>"
                ),
            ),
            sec(
                context=ctx_where(f"({neg}).not() and ({afw})"),
                text=(
                    "<p>Klinisch en elektrocardiografisch afwijkende "
                    "inspanningstest.</p>"
                ),
            ),
            sec(
                context=ctx_where(
                    f"({neg}).not() and ({afw}).not() "
                    f"and item.where(linkId='{BESLUIT}').answer.value.exists()"
                ),
                text=f"<p>{fld(BESLUIT)}</p>",
            ),
        ],
    )


# -- Assemble -----------------------------------------------------------------


def build_composition() -> dict[str, Any]:
    return {
        "resourceType": "Composition",
        "id": "composition-template",
        "status": "final",
        "type": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "11524-6",
                    "display": "EKG study",
                }
            ]
        },
        "title": "Inspanningstest verslag",
        "date": "2026-04-27",
        "section": [
            build_intro(),
            build_protocol(),
            build_inspanning(),
            build_bloeddruk_hartslag(),
            build_repolarisatie(),
            build_ritmestoornissen(),
            build_besluit(),
        ],
    }


def build_questionnaire_extract(questionnaire: dict) -> dict:
    q = dict(questionnaire)
    # Drop the preset QRs from the questionnaire-extract; keep only the
    # Composition template as a contained resource.
    q["contained"] = [build_composition()]
    extensions = list(q.get("extension", []))
    # Remove any prior templateExtract extension before adding ours
    extensions = [
        e
        for e in extensions
        if e.get("url")
        != "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtract"
    ]
    extensions.append(
        {
            "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtract",
            "extension": [
                {"url": "template", "valueReference": {"reference": "#composition-template"}}
            ],
        }
    )
    q["extension"] = extensions
    meta = dict(q.get("meta", {}))
    profiles = list(meta.get("profile", []))
    profile_url = (
        "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-template"
    )
    if profile_url not in profiles:
        profiles.append(profile_url)
    meta["profile"] = profiles
    q["meta"] = meta
    return q


def main() -> None:
    from pathlib import Path

    iteration_dir = Path(__file__).parent
    with open(iteration_dir / "questionnaire.json") as f:
        questionnaire = json.load(f)

    result = build_questionnaire_extract(questionnaire)

    output_path = iteration_dir / "questionnaire-extract.json"
    with open(output_path, "w") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    def count_sections(sections: list) -> int:
        return sum(1 + count_sections(s.get("section", [])) for s in sections)

    n = count_sections(result["contained"][0]["section"])
    print(f"Generated {output_path.name} with {n} sections")


if __name__ == "__main__":
    main()
