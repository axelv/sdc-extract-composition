#!/usr/bin/env python3
"""Generate the Composition template for coloscopie text generation.

Produces a FHIR Composition resource with sections that encode
the conditional logic from tekstgeneratie_coloscopie.html as
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

# -- Code systems ---------------------------------------------------------------
SCT = "http://snomed.info/sct"
TIRO = "http://templates.tiro.health/templates/3499e844feaa47a3acca12d4a51fc09c/custom-codes"
TIRO2 = "http://templates.tiro.health/templates/a6c95d6047764209af0dd7bce4494e56/custom-codes"

# -- Answer codes from the Questionnaire ---------------------------------------
# SNOMED ja/nee
JA = "373066001"
NEE = "373067005"

# Sedatie
SEDATIE_NEE = NEE
SEDATIE_PROCEDUREEL = "0192058a-9c01-7eed-9d3e-21a716d9fb7a"
SEDATIE_ANESTHESIE = "399097000"

# Insertiediepte (custom codes — no system)
INS_CAECUM = "caecum"
INS_TERMINALE_ILEUM = "terminale-ileum"

# Carcinoom
CAR_NEE_VERMELDEN = "01922946-802f-7117-87b2-a2f9dd3788e6"

# Divertikels locatie
LOC_SIGMOID = "60184004"
LOC_LINKER_COLON = "55572008"
LOC_VOLLEDIG_COLON = "0196f8a1-4638-777d-9da0-be5f1c85aa58"

# Caecal patch
CAECAL_PATCH_JA = "01921e4a-235d-7999-9d73-6d5595c06084"

# SES-CD scores
SES_GEEN = "260413007"  # "geen" for zweren, ulceratie, vernauwing
SES_ONAANGETAST = "cdc6ebf2fce34e5a83c0eba6ec90b844"  # aangetaste oppervlakte = onaangetast

# Problemen bij voorbereiding
PROBLEMEN_GEEN = NEE  # Uses same code as Nee (373067005)

def coding(system: str, code: str) -> str:
    """FHIRPath %factory.Coding(system, code) literal."""
    return f"%factory.Coding('{system}', '{code}')"


# -- Questionnaire item paths --------------------------------------------------
G = "item.where(linkId='group')"
POL = "item.where(linkId='poliepen')"
DIV = "item.where(linkId='divertikels')"
CAR = "item.where(linkId='carcinoom')"
CU = "item.where(linkId='colitis-ulcerosa')"
ZC = "item.where(linkId='ziekte-van-crohn')"
SES_BASE = (
    "item.where(linkId='ses-cd-score')"
    ".item.where(linkId='ses-cd')"
)


# -- Helpers -------------------------------------------------------------------

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
    """Build a FHIR Composition section."""
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
    """Child section condition: %context.where(predicate).

    Use for children whose parent sets a context.
    The predicate filters the parent's context item.
    """
    return f"%context.where({predicate})"


def res_where(predicate: str) -> str:
    """Root condition: %resource.where(predicate).

    Use for sections without a parent context (e.g., Besluit children).
    After evaluation, %context in text = the QR root.
    """
    return f"%resource.where({predicate})"


# -- Section builders ----------------------------------------------------------

def build_procedure_info() -> dict:
    return sec(
        title="Procedure info",
        context=f"%resource.{G}",
        text=(
            "<p>Coloscopie uitgevoerd op "
            "{{%context.item.where(linkId='datum-procedure').answer.value}} "
            "door {{%context.item.where(linkId='uitvoerende-arts').answer.value.display}}.</p>"
            "<p>Indicatie: "
            f"{{{{iif(%context.item.where(linkId='urgentie').answer.value ~ {coding(SCT, JA)}, 'Urgentie, ', '')}}}}"
            "{{%context.item.where(linkId='indicatie').answer.value.display}}</p>"
            "<!-- sections -->"
        ),
        children=[
            sec(
                context=ctx_where(
                    "item.where(linkId='verwijzer').answer.value.code = 'via-specialist-extern'"
                ),
                text=(
                    "<p>Patiënt verwezen via "
                    "{{%context.item.where(linkId='verwijzer').answer.item"
                    ".where(linkId='verwijzend-ziekenhuis').answer.value.display}}, "
                    "{{%context.item.where(linkId='verwijzer').answer.item"
                    ".where(linkId='verwijzend-ziekenhuis').answer.item"
                    ".where(linkId='verwijzende-specialist').answer.value.display}}.</p>"
                ),
            ),
        ],
    )


def build_sedatie() -> dict:
    """Sedatie & medicatie — 3 exclusive branches + bloedverdunners."""
    sed = "item.where(linkId='sedatie').answer.value"
    bv = "item.where(linkId='bloedverdunners').answer.value"

    return sec(
        title="Sedatie & medicatie",
        context=f"%resource.{G}",
        text="<!-- sections -->",
        children=[
            sec(
                context=ctx_where(f"{sed} ~ {coding(SCT, SEDATIE_NEE)}"),
                text="<p>Onderzoek zonder sedatie.</p>",
            ),
            sec(
                context=ctx_where(f"{sed} ~ {coding(TIRO, SEDATIE_PROCEDUREEL)}"),
                text="<p>Onderzoek onder procedurele sedatie.</p>",
            ),
            sec(
                context=ctx_where(f"{sed} ~ {coding(SCT, SEDATIE_ANESTHESIE)}"),
                text=(
                    "<p>Onderzoek onder anesthesie, uitgevoerd door "
                    "{{%context.item.where(linkId='sedatie').answer.item"
                    ".where(linkId='anesthesist').answer.value.display}}.</p>"
                ),
            ),
            sec(
                context=ctx_where(f"{bv} !~ {coding(SCT, NEE)}"),
                text=(
                    "<p>Patiënt onder "
                    "{{%context.item.where(linkId='bloedverdunners').answer.value.display}}.</p>"
                    "<!-- sections -->"
                ),
                children=[
                    sec(
                        context=ctx_where(
                            "item.where(linkId='bloedverdunners').answer.item"
                            ".where(linkId='herstarten-op').answer.value.exists()"
                        ),
                        text=(
                            "<p>{{%context.item.where(linkId='bloedverdunners').answer.value.display}} "
                            "herstarten op: "
                            "{{%context.item.where(linkId='bloedverdunners').answer.item"
                            ".where(linkId='herstarten-op').answer.value}}.</p>"
                        ),
                    ),
                ],
            ),
        ],
    )


def build_voorbereiding() -> dict:
    bbps = "item.where(linkId='boston-bowel-preparation-scale')"
    bbps_score = f"{{{{%context.{bbps}.item.where(linkId='boston-bowel-preparation-scale-2').answer.value}}}}"
    bbps_reiniging = f"{{{{%context.{bbps}.item.where(linkId='darmreiniging').answer.value.display}}}}"
    return sec(
        title="Colonvoorbereiding",
        context=f"%resource.{G}",
        text=(
            "<p>Colonvoorbereiding: "
            "{{%context.item.where(linkId='colonvoorbereiding').answer.value.display}}</p>"
            "<!-- sections -->"
            f"<p>BBPS: {bbps_score} /9, darmreiniging {bbps_reiniging}</p>"
        ),
        children=[
            sec(
                context=ctx_where(
                    f"item.where(linkId='problemen-bij-voorbereiding').answer.value !~ {coding(SCT, PROBLEMEN_GEEN)}"
                ),
                text=(
                    "<p>Problemen bij voorbereiding: "
                    "{{%context.item.where(linkId='problemen-bij-voorbereiding').answer.value.display}}</p>"
                ),
            ),
        ],
    )


def build_insertiediepte() -> dict:
    caecum = "item.where(linkId='caecum-bereikt')"
    ins = f"{caecum}.item.where(linkId='insertiediepte').answer.value.code"

    ins_display = f"{{{{%context.{caecum}.item.where(linkId='insertiediepte').answer.value.display}}}}"
    return sec(
        title="Insertiediepte & inspectie",
        context=f"%resource.{G}",
        text=(
            f"<p>Insertiediepte: {ins_display}.</p>"
            "<!-- sections -->"
            "<p>Terugtrektijd: "
            "{{%context.item.where(linkId='terugtrektijd-min').answer.value}} min "
            "{{%context.item.where(linkId='terugtrektijd-sec').answer.value}} sec</p>"
            "<p>Retrovisie ascendens: "
            "{{%context.item.where(linkId='retrovisie-ascendens').answer.value.display}}</p>"
            "<p>Retrovisie rectum: "
            "{{%context.item.where(linkId='retrovisie-rectum').answer.value.display}}</p>"
        ),
        children=[
            sec(
                context=ctx_where(
                    f"{ins} != '{INS_CAECUM}' and {ins} != '{INS_TERMINALE_ILEUM}'"
                ),
                text=f"<p>Caecum niet bereikt omwille van {{{{%context.{caecum}.item.where(linkId='oorzaak').answer.value.display}}}}.</p>",
            ),
        ],
    )


def build_poliepen() -> dict:
    """Polyp section — repeating block per polyp."""
    res_val = "item.where(linkId='resectie').answer.value"
    res = "item.where(linkId='resectie').answer.item"

    def rf(lid: str, prop: str = "") -> str:
        """Field under resectie answer.item."""
        s = f".{prop}" if prop else ""
        return "{{%context." + res + f".where(linkId='{lid}').answer.value{s}" + "}}"

    def nbl(lid: str, prop: str = "") -> str:
        """Field under nabloeding answer.item."""
        s = f".{prop}" if prop else ""
        return (
            "{{%context." + res
            + f".where(linkId='nabloeding').answer.item.where(linkId='{lid}').answer.value{s}"
            + "}}"
        )

    def mark(lid: str, prop: str = "") -> str:
        """Field under markering answer.item."""
        s = f".{prop}" if prop else ""
        return (
            "{{%context." + res
            + f".where(linkId='markering').answer.item.where(linkId='{lid}').answer.value{s}"
            + "}}"
        )

    def pf(lid: str, prop: str = "") -> str:
        """Field under polyp item."""
        s = f".{prop}" if prop else ""
        return "{{%context.item.where(linkId='" + lid + "').answer.value" + s + "}}"

    def opt(lid: str, prefix: str, prop: str = "display") -> str:
        """Optional inline modifier using iif()."""
        expr = f"%context.item.where(linkId='{lid}').answer.value"
        return "{{" + f"iif({expr}.exists(), '{prefix}' + {expr}.{prop}, '')" + "}}"

    nbl_val = f"{res}.where(linkId='nabloeding').answer.value"
    hem_val = (
        f"{res}.where(linkId='nabloeding').answer.item"
        ".where(linkId='succesvolle-hemostase').answer.value"
    )

    lifting_iif = (
        "{{iif(%context." + res + ".where(linkId='lifting').answer.value.exists(), "
        "'lifting en vervolgens ' + %context." + res + ".where(linkId='lifting').answer.value.display + ' ', "
        "''"
        ")}}"
    )

    resectie_children = [
        sec(
            context=ctx_where(f"{res}.where(linkId='biopten').answer.value ~ {coding(SCT, JA)}"),
            text=f"<p>Biopten in potje # {rf('potje')}.</p>",
        ),
        sec(
            context=ctx_where(f"{res}.where(linkId='recuperatie').answer.value ~ {coding(SCT, JA)}"),
            text=f"<p>Recuperatie voor pathologie (potje # {rf('potje-2')}).</p>",
        ),
        sec(
            context=ctx_where(f"{res}.where(linkId='recuperatie').answer.value ~ {coding(SCT, NEE)}"),
            text="<p>Geen recuperatie voor pathologie.</p>",
        ),
        sec(
            context=ctx_where(f"{res}.where(linkId='termale-ablatie-van-de-randen').answer.value ~ {coding(SCT, JA)}"),
            text="<p>Termale ablatie van de randen uitgevoerd.</p>",
        ),
        sec(
            context=ctx_where(f"{nbl_val} ~ {coding(SCT, JA)}"),
            text="<p>Ontstaan van bloeding na resectie</p><!-- sections -->",
            children=[
                sec(
                    context=ctx_where(f"{hem_val} ~ {coding(SCT, JA)}"),
                    text=f"<p>waarvoor succesvolle hemostase middels {nbl('modaliteit-2', 'display')}</p>",
                ),
                sec(
                    context=ctx_where(f"{hem_val} ~ {coding(SCT, NEE)}"),
                    text=f"<p>waarvoor poging tot hemostase niet succesvol ondanks {nbl('modaliteit-2', 'display')}</p>",
                ),
            ],
        ),
        sec(
            context=ctx_where(f"{res}.where(linkId='markering').answer.value ~ {coding(SCT, JA)}"),
            text=(
                f"<p>Aanbrengen van markering {mark('locatie-2', 'display')}"
                f" met {mark('modaliteit-3', 'display')}</p>"
            ),
        ),
    ]

    polyp_text = (
        f"<p>Ter hoogte van {pf('locatie', 'display')}"
        f" op {pf('afstand')} cm, "
        f"{pf('architectuur', 'display')} poliep van "
        f"{pf('grootte', 'display')}"
        f"{opt('lst-type', ', ')}"
        f"{opt('mucosaal-patroon', ', ')}"
        f"{opt('wasp', ', WASP ')}"
        f"{opt('jnet-type', ', ')}"
        ".</p><!-- sections -->"
    )

    return sec(
        title="Poliepen",
        context=f"%resource.{POL}",
        text="<!-- sections -->",
        children=[
            sec(
                context="%context.item.where(linkId='poliep')",
                text=polyp_text,
                children=[
                    sec(
                        context=ctx_where(f"{res_val} ~ {coding(SCT, JA)}"),
                        text=(
                            f"<p>waarvoor {lifting_iif}"
                            f"{rf('device', 'display')} "
                            f"{rf('modaliteit', 'display')}.</p>"
                            "<!-- sections -->"
                        ),
                        children=resectie_children,
                    ),
                ],
            ),
        ],
    )


def build_divertikels() -> dict:
    dc = "item.where(linkId='divertikels-2').answer.value"
    lc = "item.where(linkId='locatie-3').answer.value"

    return sec(
        title="Divertikels",
        context=f"%resource.{DIV}",
        text="<!-- sections -->",
        children=[
            sec(
                context=ctx_where(
                    f"{dc} ~ {coding(SCT, JA)} and ({lc} ~ {coding(SCT, LOC_SIGMOID)} or {lc} ~ {coding(SCT, LOC_LINKER_COLON)})"
                ),
                text="<p>Divertikels ter hoogte van het {{%context.item.where(linkId='locatie-3').answer.value.display}}</p>",
            ),
            sec(
                context=ctx_where(f"{dc} ~ {coding(SCT, JA)} and {lc} ~ {coding(TIRO, LOC_VOLLEDIG_COLON)}"),
                text="<p>Divertikels over het hele colonkader</p>",
            ),
        ],
    )


def build_stenose() -> dict:
    return sec(
        title="Stenose & inflammatie",
        context=f"%resource.{DIV}",
        text="<!-- sections -->",
        children=[
            sec(
                context=ctx_where(f"item.where(linkId='stenoserend').answer.value ~ {coding(SCT, JA)}"),
                text="<p>Stenoserend, {{%context.item.where(linkId='te-passeren').answer.value.display}}</p>",
            ),
            sec(
                context=ctx_where("item.where(linkId='tekenen-van-inflammatie').answer.value.exists()"),
                text="<p>Tekenen van inflammatie: {{%context.item.where(linkId='tekenen-van-inflammatie').answer.value.display}}</p>",
            ),
        ],
    )


def build_carcinoom() -> dict:
    cc = "item.where(linkId='carcinoom-2').answer.value"

    return sec(
        title="Carcinoom",
        context=f"%resource.{CAR}",
        text="<!-- sections -->",
        children=[
            sec(
                context=ctx_where(f"{cc} ~ {coding(TIRO, CAR_NEE_VERMELDEN)}"),
                text="<p>Geen carcinogene letsels gedetecteerd.</p>",
            ),
            sec(
                context=ctx_where(f"{cc} ~ {coding(SCT, JA)}"),
                text=(
                    "<p>{{%context.item.where(linkId='morfologie').answer.value.display}} "
                    "carcinoom ter hoogte van "
                    "{{%context.item.where(linkId='locatie-4').answer.value.display}}.</p>"
                    "<!-- sections -->"
                ),
                children=[
                    sec(
                        context=ctx_where(f"item.where(linkId='stenoserend-2').answer.value ~ {coding(SCT, JA)}"),
                        text="<p>Stenoserend, {{%context.item.where(linkId='te-passeren-2').answer.value.display}}</p>",
                    ),
                    sec(
                        context=ctx_where(f"item.where(linkId='stenoserend-2').answer.value ~ {coding(SCT, NEE)}"),
                        text="<p>Niet stenoserend.</p>",
                    ),
                    sec(
                        context=ctx_where(f"item.where(linkId='biopten-2').answer.value ~ {coding(SCT, JA)}"),
                        text=(
                            "<p>Biopten in potje # "
                            "{{%context.item.where(linkId='biopten-2').answer.item"
                            ".where(linkId='potje-3').answer.value}}.</p>"
                        ),
                    ),
                    sec(
                        context=ctx_where(f"item.where(linkId='markering-2').answer.value ~ {coding(SCT, JA)}"),
                        text=(
                            "<p>Aanbrengen van markering "
                            "{{%context.item.where(linkId='markering-2').answer.item"
                            ".where(linkId='locatie-5').answer.value.display}} met "
                            "{{%context.item.where(linkId='markering-2').answer.item"
                            ".where(linkId='modaliteit-4').answer.value.display}}</p>"
                        ),
                    ),
                ],
            ),
        ],
    )


def build_colitis_ulcerosa() -> dict:
    return sec(
        title="Colitis ulcerosa",
        context=f"%resource.{CU}",
        text="<!-- sections -->",
        children=[
            sec(
                context=ctx_where(f"item.where(linkId='colitis-ulcerosa-2').answer.value ~ {coding(SCT, JA)}"),
                text=(
                    "<p>Colitis ulcerosa met letsels ter hoogte van "
                    "{{%context.item.where(linkId='locatie-6').answer.value.display}}"
                    f"{{{{iif(%context.item.where(linkId='caecal-patch').answer.value ~ {coding(TIRO, CAECAL_PATCH_JA)}, ' en caecal patch', '')}}}}"
                    ". Mayo score: {{%context.item.where(linkId='mayo-score').answer.value.display}}. "
                    "Backwash ileitis {{%context.item.where(linkId='backwash-ileitis').answer.value.display}}</p>"
                ),
            ),
        ],
    )


# -- Crohn segments ------------------------------------------------------------

CROHN_SEGMENTS = [
    {"name": "Ileum", "status": "ileum", "zweren": "ileum-2", "ulc": "ileum-3", "opp": "ileum-4", "vern": "ileum-5"},
    {"name": "Rechter colon", "status": "rechter-colon-2", "zweren": "rechter-colon-3", "ulc": "rechter-colon-4", "opp": "rechter-colon-5", "vern": "rechter-colon-6"},
    {"name": "Colon transversum", "status": "colon-transversum", "zweren": "colon-transversum-2", "ulc": "colon-transversum-3", "opp": "colon-transversum-4", "vern": "colon-transversum-5"},
    {"name": "Sigmoïd en linker colon", "status": "sigmoid-en-linker-colon", "zweren": "sigmoid-en-linker-colon-2", "ulc": "sigmoid-en-linker-colon-3", "opp": "sigmoid-en-linker-colon-4", "vern": "sigmoid-en-linker-colon-5"},
    {"name": "Rectum", "status": "rectum", "zweren": "rectum-2", "ulc": "rectum-3", "opp": "rectum-4", "vern": "rectum-5"},
]


def _ses_dim(dimension: str, link_id: str) -> str:
    """Path within SES-CD to a specific dimension/item (relative to ZC context)."""
    return f"{SES_BASE}.item.where(linkId='{dimension}').item.where(linkId='{link_id}')"


def build_crohn_segment(seg: dict) -> list[dict]:
    """Build sections for one Crohn segment."""
    status_path = _ses_dim("status-segment", seg["status"])
    opp_path = _ses_dim("aangetaste-oppervlakte", seg["opp"])
    zweren_path = _ses_dim("grootte-van-de-zweren", seg["zweren"])
    ulc_path = _ses_dim("oppervlakte-met-ulceratie", seg["ulc"])
    vern_path = _ses_dim("aanwezigheid-van-vernauwing", seg["vern"])

    detail_children = [
        # Aangetaste oppervlakte
        sec(
            context=ctx_where(f"{opp_path}.answer.value ~ {coding(TIRO2, SES_ONAANGETAST)}"),
            text="<p>Onaangetast.</p>",
        ),
        sec(
            context=ctx_where(f"{opp_path}.answer.value !~ {coding(TIRO2, SES_ONAANGETAST)} and {opp_path}.answer.value.exists()"),
            text=f"<p>Aangetaste oppervlakte: {{{{%context.{opp_path}.answer.value.display}}}}.</p>",
        ),
        # Grootte zweren
        sec(
            context=ctx_where(f"{zweren_path}.answer.value ~ {coding(SCT, SES_GEEN)}"),
            text="<p>Geen zweren.</p>",
        ),
        sec(
            context=ctx_where(f"{zweren_path}.answer.value !~ {coding(SCT, SES_GEEN)} and {zweren_path}.answer.value.exists()"),
            text=f"<p>{{{{%context.{zweren_path}.answer.value.display}}}}.</p>",
        ),
        # Ulceratie
        sec(
            context=ctx_where(f"{ulc_path}.answer.value ~ {coding(SCT, SES_GEEN)}"),
            text="<p>Geen ulceraties.</p>",
        ),
        sec(
            context=ctx_where(f"{ulc_path}.answer.value !~ {coding(SCT, SES_GEEN)} and {ulc_path}.answer.value.exists()"),
            text=f"<p>Ulceraties aanwezig over een oppervlak van {{{{%context.{ulc_path}.answer.value.display}}}}.</p>",
        ),
    ]

    return [
        # Status filled
        sec(
            context=ctx_where(f"{status_path}.answer.value.exists()"),
            text=f"<p><strong>{seg['name']}:</strong> {{{{%context.{status_path}.answer.value.display}}}}</p>",
        ),
        # Status empty → show SES-CD details
        sec(
            context=ctx_where(f"{status_path}.answer.value.exists().not()"),
            text=(
                f"<p><strong>{seg['name']}:</strong> "
                f"{{{{%context.{vern_path}.answer.value.display}}}}</p>"
                "<!-- sections -->"
            ),
            children=detail_children,
        ),
    ]


def build_ziekte_van_crohn() -> dict:
    segment_sections: list[dict] = []
    for seg in CROHN_SEGMENTS:
        segment_sections.extend(build_crohn_segment(seg))

    # SES-CD total score
    segment_sections.append(
        sec(text=(
            "<p>SES-CD score: "
            f"{{{{%context.{SES_BASE}.item.where(linkId='ses-cd-score-2').answer.value}}}}</p>"
        )),
    )

    return sec(
        title="Ziekte van Crohn",
        context=f"%resource.{ZC}",
        text="<!-- sections -->",
        children=[
            sec(
                context=ctx_where(f"item.where(linkId='group-2').answer.value ~ {coding(SCT, JA)}"),
                text="<!-- sections -->",
                children=segment_sections,
            ),
        ],
    )


# -- Besluit -------------------------------------------------------------------

def build_besluit() -> dict:
    """Besluit spans all groups — uses %resource.where() with full paths in text."""
    ins = f"{G}.item.where(linkId='caecum-bereikt').item.where(linkId='insertiediepte').answer.value"
    pol = f"{POL}.item.where(linkId='poliep-en-aanwezig').answer.value"
    dc = f"{DIV}.item.where(linkId='divertikels-2').answer.value"
    lc = f"{DIV}.item.where(linkId='locatie-3').answer.value"
    cc = f"{CAR}.item.where(linkId='carcinoom-2').answer.value"
    cu = f"{CU}.item.where(linkId='colitis-ulcerosa-2').answer.value"
    cr = f"{ZC}.item.where(linkId='group-2').answer.value"

    # For aggregation across polyps, use .where().exists() to avoid collection comparison issues
    polyp_nbl = (
        f"{POL}.item.where(linkId='poliep')"
        f".where(item.where(linkId='resectie').answer.item.where(linkId='nabloeding').answer.value ~ {coding(SCT, JA)})"
    )
    polyp_hem_ja = (
        f"{POL}.item.where(linkId='poliep')"
        ".where(item.where(linkId='resectie').answer.item"
        ".where(linkId='nabloeding').answer.item"
        f".where(linkId='succesvolle-hemostase').answer.value ~ {coding(SCT, JA)})"
    )
    polyp_hem_nee = (
        f"{POL}.item.where(linkId='poliep')"
        ".where(item.where(linkId='resectie').answer.item"
        ".where(linkId='nabloeding').answer.item"
        f".where(linkId='succesvolle-hemostase').answer.value ~ {coding(SCT, NEE)})"
    )

    # Text helpers using full paths (since %context = QR root for res_where)
    def rt(group: str, lid: str, prop: str = "") -> str:
        s = f".{prop}" if prop else ""
        return "{{%context." + f"item.where(linkId='{group}').item.where(linkId='{lid}').answer.value{s}" + "}}"

    return sec(
        title="Besluit",
        text="<!-- sections -->",
        children=[
            sec(
                context=res_where(f"{ins}.code = '{INS_CAECUM}'"),
                text="<p>Totale coloscopie.</p>",
            ),
            sec(
                context=res_where(f"{ins}.code = '{INS_TERMINALE_ILEUM}'"),
                text="<p>Totale ileocoloscopie.</p>",
            ),
            sec(
                context=res_where(f"{ins}.code != '{INS_CAECUM}' and {ins}.code != '{INS_TERMINALE_ILEUM}'"),
                text=(
                    f"<p>Onvolledige coloscopie wegens {{{{%context.{G}.item.where(linkId='caecum-bereikt').item.where(linkId='oorzaak').answer.value.display}}}}"
                    f", inspectie tot {{{{%context.{G}.item.where(linkId='caecum-bereikt').item.where(linkId='insertiediepte').answer.value.display}}}}.</p>"
                ),
            ),
            # Normale bevindingen
            sec(
                context=res_where(
                    f"{pol} ~ {coding(SCT, NEE)} and {dc} ~ {coding(SCT, NEE)} and {cc} ~ {coding(SCT, NEE)} and {cu} ~ {coding(SCT, NEE)} and {cr} ~ {coding(SCT, NEE)}"
                ),
                text="<p>Normale endoscopische bevindingen.</p>",
            ),
            # Poliepen
            sec(
                context=res_where(f"{pol} ~ {coding(SCT, JA)}"),
                text=(
                    f"<p>Aanwezigheid van {{{{%context.{POL}.item.where(linkId='poliep').count()}}}} poliep(en)"
                    f", waarvan {{{{%context.{POL}.item.where(linkId='poliep')"
                    f".where(item.where(linkId='resectie').answer.value ~ {coding(SCT, JA)}).count()}}}} gereseceerd.</p>"
                    "<!-- sections -->"
                ),
                children=[
                    sec(
                        context=res_where(f"{polyp_nbl}.exists()"),
                        text="<p>Ontstaan van bloeding na resectie</p><!-- sections -->",
                        children=[
                            sec(context=res_where(f"{polyp_hem_ja}.exists()"), text="<p>waarvoor succesvolle hemostase.</p>"),
                            sec(context=res_where(f"{polyp_hem_nee}.exists()"), text="<p>waarvoor poging tot hemostase niet succesvol.</p>"),
                        ],
                    ),
                ],
            ),
            # Divertikels
            sec(
                context=res_where(f"{dc} ~ {coding(SCT, JA)} and ({lc} ~ {coding(SCT, LOC_SIGMOID)} or {lc} ~ {coding(SCT, LOC_LINKER_COLON)})"),
                text=f"<p>Divertikels ter hoogte van het {{{{%context.{DIV}.item.where(linkId='locatie-3').answer.value.display}}}}</p>",
            ),
            sec(
                context=res_where(f"{dc} ~ {coding(SCT, JA)} and {lc} ~ {coding(TIRO, LOC_VOLLEDIG_COLON)}"),
                text="<p>Divertikels over het hele colonkader</p>",
            ),
            # Carcinoom
            sec(
                context=res_where(f"{cc} ~ {coding(TIRO, CAR_NEE_VERMELDEN)}"),
                text="<p>Geen carcinogene letsels gedetecteerd.</p>",
            ),
            sec(
                context=res_where(f"{cc} ~ {coding(SCT, JA)}"),
                text=(
                    f"<p>{{{{%context.{CAR}.item.where(linkId='morfologie').answer.value.display}}}} "
                    f"carcinoom ter hoogte van {{{{%context.{CAR}.item.where(linkId='locatie-4').answer.value.display}}}}.</p>"
                ),
            ),
            # CU
            sec(
                context=res_where(f"{cu} ~ {coding(SCT, JA)}"),
                text=(
                    f"<p>Colitis ulcerosa met letsels ter hoogte van {{{{%context.{CU}.item.where(linkId='locatie-6').answer.value.display}}}}"
                    f"{{{{iif(%context.{CU}.item.where(linkId='caecal-patch').answer.value ~ {coding(TIRO, CAECAL_PATCH_JA)}, ' en caecal patch', '')}}}}"
                    f". Mayo score: {{{{%context.{CU}.item.where(linkId='mayo-score').answer.value.display}}}}.</p>"
                ),
            ),
            # Crohn
            sec(
                context=res_where(f"{cr} ~ {coding(SCT, JA)}"),
                text=f"<p>SES-CD score: {{{{%context.{ZC}.{SES_BASE}.item.where(linkId='ses-cd-score-2').answer.value}}}}</p>",
            ),
        ],
    )


# -- Assemble ------------------------------------------------------------------

def build_composition() -> dict[str, Any]:
    return {
        "resourceType": "Composition",
        "id": "composition-template",
        "status": "final",
        "type": {
            "coding": [{
                "system": "http://loinc.org",
                "code": "11488-4",
                "display": "Consultation note",
            }]
        },
        "title": "Coloscopie verslag",
        "date": "2024-01-01",
        "section": [
            build_procedure_info(),
            build_sedatie(),
            build_voorbereiding(),
            build_insertiediepte(),
            build_poliepen(),
            build_divertikels(),
            build_stenose(),
            build_carcinoom(),
            build_colitis_ulcerosa(),
            build_ziekte_van_crohn(),
            build_besluit(),
        ],
    }


def build_questionnaire_extract(questionnaire: dict) -> dict:
    q = dict(questionnaire)
    q["contained"] = [build_composition()]
    extensions = q.get("extension", [])
    extensions.append({
        "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-templateExtract",
        "extension": [{"url": "template", "valueReference": {"reference": "#composition-template"}}],
    })
    q["extension"] = extensions
    meta = q.get("meta", {})
    meta.setdefault("profile", []).append(
        "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-extr-template"
    )
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
