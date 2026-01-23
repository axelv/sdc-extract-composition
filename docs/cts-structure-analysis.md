# CTS Study Template Structure Analysis

## Source Document
`examples/ortho.txt` - BHSC studie CTS (Carpal Tunnel Syndrome)

## Identified Structure

```
BHSC studie CTS
├── CTS Preop An (Preoperative Anamnesis)
│   ├── General: HAND, klacht
│   ├── Symptoms: nachtelijke tintelingen, fijne motoriek, duur symptomen, subjectief krachtsverlies
│   ├── Infiltrations: ja/neen, aantal, tijdstip laatste
│   ├── Patient Profile: dominantie, beroep, hobby
│   └── Medical History: allergie, roken, diabetes, RA, SKlijden, voorgaande handchirurgie
│
├── CTS Preop KO (Preoperative Clinical Examination)
│   ├── Pressure Pain: drukpijn
│   ├── Clinical Tests (bilateral RE/LI):
│   │   ├── Thenar atrofie (+/-)
│   │   ├── Durkan (+/-)
│   │   ├── Tinel (+/-)
│   │   ├── Phalen (+/-)
│   │   └── Reversed Phalen (+/-)
│   ├── Range of Motion (bilateral): CPP, PDPP
│   ├── Strength /5 (bilateral): oppositie, FPL, FDP 2
│   ├── Strength in kgF (bilateral): Key pinch, Precision pinch, Jamar 2
│   ├── Sensitivity: Weber 2-pt discrim per digit
│   └── Additional Tests (bilateral): Scratch collapse test, Lacertus
│
├── CTS Preop TO (Preoperative Technical Examination)
│   ├── EMG Canterbury scale (1-6)
│   └── echo pols (nvt|inlet diameter)
│
├── CTS Postop An (Postoperative Anamnesis)
│   ├── General: HAND, pijn, duur pijnstilling
│   ├── Symptom Evolution: tintelingen, nachtelijk wakker worden
│   └── Recovery: arbeidsongeschiktheid, hervating hobby's
│
└── CTS Postop KO (Postoperative Clinical Examination)
    ├── Scar and Pain: litteken, Pillar pain, drukpijn localisatie
    ├── Range of Motion (bilateral): CPP, PDPP
    ├── Strength /5 (bilateral): oppositie, FPL, FDS 2
    ├── Strength in KgF (bilateral): Precision pinch, Key pinch, Jamar 2
    ├── Sensitivity: Weber 2-pt discrim per digit
    └── Additional Tests (bilateral): Scratch collapse test, Lacertus
```

## Field Types Identified

### Choice Fields
| Pattern | Example | Meaning |
|---------|---------|---------|
| `{OPTION1\|OPTION2}` | `{RECHTS\|LINKS\|RECHTS EN LINKS}` | Single choice |
| `{ja\|neen}` | Infiltraties `{ja\|neen}` | Boolean (yes/no) |
| `{+\|-}` | Thenar atrofie `{+\|-}` | Positive/Negative finding |
| `{1\|2\|3\|4\|5\|6}` | EMG Canterbury scale | Ordinal scale |

### Free Text Fields
| Pattern | Example |
|---------|---------|
| `{}` | klacht `{}`, Beroep `{}` |
| `{\|geen gekende}` | Allergie (with default option) |
| `{/}` | Weber 2-pt discrim (rad/uln format) |

### Conditional Fields
| Pattern | Example |
|---------|---------|
| `zo ja: ...` | Infiltraties: if yes, show count and date |
| Diabetes type only if Diabetes = ja | |

### Duration Fields
| Pattern | Example |
|---------|---------|
| `{} d` | duur pijnstilling (days) |
| `{} {d\|w}` | arbeidsongeschiktheid (days or weeks) |

## Bilateral Fields (RE/LI)

Many examination fields are bilateral with columns for:
- **RE** (Rechts/Right)
- **LI** (Links/Left)

These should map to FHIR using:
- `Observation.bodySite` with laterality codes
- Or separate items with linkId suffixes `-re` and `-li`

## Mapping to FHIR Composition

### Section Codes
Using a custom CodeSystem `http://example.org/cts-sections`:

| Code | Display | Original |
|------|---------|----------|
| `preop-anamnesis` | Preoperative Anamnesis | CTS Preop An |
| `preop-clinical-exam` | Preoperative Clinical Examination | CTS Preop KO |
| `preop-technical-exam` | Preoperative Technical Examination | CTS Preop TO |
| `postop-anamnesis` | Postoperative Anamnesis | CTS Postop An |
| `postop-clinical-exam` | Postoperative Clinical Examination | CTS Postop KO |

### Nested Sections
Each major section contains sub-sections grouping related fields:
- General information
- Symptoms
- Tests (clinical, technical)
- Recovery metrics

## Notes

1. **Study inclusion criteria**: EMG Canterbury scale gr 2-4 only (noted in template)
2. **Preop vs Postop differences**:
   - Preop KO has FDP 2, Postop KO has FDS 2
   - Different symptom evolution questions in postop
3. **Abbreviations**:
   - KO = Klinisch Onderzoek (Clinical Examination)
   - An = Anamnese (Medical History)
   - TO = Technisch Onderzoek (Technical Examination)
   - RE = Rechts (Right)
   - LI = Links (Left)
   - CPP = ? (Range of Motion measurement)
   - PDPP = ? (Range of Motion measurement)
   - FPL = Flexor Pollicis Longus
   - FDP = Flexor Digitorum Profundus
   - FDS = Flexor Digitorum Superficialis
   - RA = Rheumatoid Arthritis
   - SKlijden = Schildklierlijden (Thyroid disease)
