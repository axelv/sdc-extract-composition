import { useState } from "react";
import "./tutorial-modal.css";

interface TutorialModalProps {
  onClose: () => void;
}

export function TutorialModal({ onClose }: TutorialModalProps) {
  const [currentSection, setCurrentSection] = useState(0);

  const sections = [
    { id: "overview", title: "Overzicht" },
    { id: "panels", title: "De Drie Panelen" },
    { id: "add-section", title: "Secties Toevoegen" },
    { id: "context-types", title: "Context Types" },
    { id: "variables", title: "Placeholders Invoegen" },
    { id: "formatting", title: "Opmaak & Filters" },
    { id: "save-work", title: "Werk Opslaan" },
  ];

  return (
    <div className="tutorial-overlay" onClick={onClose}>
      <div className="tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <button className="tutorial-close" onClick={onClose}>
          &times;
        </button>

        <div className="tutorial-sidebar">
          <h2>Tutorial</h2>
          <nav>
            {sections.map((section, i) => (
              <button
                key={section.id}
                className={`tutorial-nav-item ${currentSection === i ? "active" : ""}`}
                onClick={() => setCurrentSection(i)}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </div>

        <div className="tutorial-content">
          {currentSection === 0 && <OverviewSection />}
          {currentSection === 1 && <PanelsSection />}
          {currentSection === 2 && <AddSectionSection />}
          {currentSection === 3 && <ContextTypesSection />}
          {currentSection === 4 && <VariablesSection />}
          {currentSection === 5 && <FormattingSection />}
          {currentSection === 6 && <SaveWorkSection />}

          <div className="tutorial-footer">
            <button
              className="tutorial-btn"
              onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
              disabled={currentSection === 0}
            >
              Vorige
            </button>
            <span className="tutorial-progress">
              {currentSection + 1} / {sections.length}
            </span>
            {currentSection < sections.length - 1 ? (
              <button
                className="tutorial-btn primary"
                onClick={() => setCurrentSection(currentSection + 1)}
              >
                Volgende
              </button>
            ) : (
              <button className="tutorial-btn primary" onClick={onClose}>
                Aan de slag
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewSection() {
  return (
    <div className="tutorial-section">
      <h1>Welkom bij de Compositie Editor</h1>
      <p className="tutorial-intro">
        Deze tool helpt je bij het automatisch genereren van medische brieven
        op basis van ingevulde vragenlijsten.
      </p>

      <div className="tutorial-diagram">
        <div className="tutorial-flow">
          <div className="tutorial-flow-item">
            <div className="tutorial-flow-icon">📝</div>
            <div className="tutorial-flow-label">Formulier Invullen</div>
          </div>
          <div className="tutorial-flow-arrow">→</div>
          <div className="tutorial-flow-item">
            <div className="tutorial-flow-icon">⚙️</div>
            <div className="tutorial-flow-label">Template</div>
          </div>
          <div className="tutorial-flow-arrow">→</div>
          <div className="tutorial-flow-item">
            <div className="tutorial-flow-icon">📄</div>
            <div className="tutorial-flow-label">Medische Brief</div>
          </div>
        </div>
      </div>

      <div className="tutorial-tip">
        <strong>Hoe het werkt:</strong> Je maakt secties met placeholders die
        automatisch waarden ophalen uit het formulier. Bij het invullen worden
        de placeholders vervangen door de werkelijke waarden.
      </div>
    </div>
  );
}

function PanelsSection() {
  return (
    <div className="tutorial-section">
      <h1>De Drie Panelen</h1>

      <div className="tutorial-panels-demo">
        <div className="tutorial-panel-mock">
          <div className="tutorial-panel-header">Vragenlijst</div>
          <div className="tutorial-panel-body">
            <div className="tutorial-form-field">
              <label>Patiëntnaam</label>
              <input type="text" value="Jan Jansen" readOnly />
            </div>
            <div className="tutorial-form-field">
              <label>Diagnose</label>
              <input type="text" value="Hypertensie" readOnly />
            </div>
          </div>
        </div>

        <div className="tutorial-panel-arrow">→</div>

        <div className="tutorial-panel-mock">
          <div className="tutorial-panel-header">Compositie</div>
          <div className="tutorial-panel-body">
            <div className="tutorial-section-card">
              <div className="tutorial-section-title">Patiëntgegevens</div>
              <div className="tutorial-section-content">
                Patiënt: <span className="tutorial-pill">Patiëntnaam</span>
              </div>
            </div>
            <div className="tutorial-section-card">
              <div className="tutorial-section-title">Diagnose</div>
              <div className="tutorial-section-content">
                Gediagnosticeerd met: <span className="tutorial-pill">Diagnose</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tutorial-panel-arrow">→</div>

        <div className="tutorial-panel-mock">
          <div className="tutorial-panel-header">Medische Brief</div>
          <div className="tutorial-panel-body tutorial-narrative">
            <p><strong>Patiëntgegevens</strong></p>
            <p>Patiënt: Jan Jansen</p>
            <p><strong>Diagnose</strong></p>
            <p>Gediagnosticeerd met: Hypertensie</p>
          </div>
        </div>
      </div>

      <div className="tutorial-tip">
        <strong>Linker paneel:</strong> Het formulier waar gegevens worden ingevoerd.<br />
        <strong>Middelste paneel:</strong> Je template met secties en placeholders.<br />
        <strong>Rechter paneel:</strong> Live voorbeeld van de gegenereerde brief.
      </div>
    </div>
  );
}

function AddSectionSection() {
  return (
    <div className="tutorial-section">
      <h1>Secties Toevoegen</h1>
      <p>Secties zijn de bouwstenen van je template. Elke sectie is een paragraaf in de brief.</p>

      <div className="tutorial-demo-box">
        <h3>Toevoegen Tussen Secties</h3>
        <p>Hover tussen secties om de toevoeg-knop te zien:</p>
        <div className="tutorial-real-sections">
          <div className="tutorial-real-section always">
            <div className="tutorial-real-icon">—</div>
            <div className="tutorial-real-content">
              <div className="tutorial-real-title">Patiëntgegevens</div>
              <div className="tutorial-real-body">
                Patiënt: <span className="tutorial-pill">Patiëntnaam</span>
              </div>
            </div>
            <button className="tutorial-real-delete">×</button>
          </div>
          <div className="tutorial-real-add-between">
            <div className="tutorial-real-add-btn">+</div>
          </div>
          <div className="tutorial-real-section conditional">
            <div className="tutorial-real-icon">⎇</div>
            <div className="tutorial-real-content">
              <div className="tutorial-real-title">Allergieën</div>
              <div className="tutorial-real-body">
                Details: <span className="tutorial-pill">Allergie Details</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tutorial-demo-box">
        <h3>Subsecties Toevoegen</h3>
        <p>Hover over een sectie om de subsectie-knop te zien:</p>
        <div className="tutorial-real-sections">
          <div className="tutorial-real-section always wide">
            <div className="tutorial-real-icon">—</div>
            <div className="tutorial-real-content">
              <div className="tutorial-real-title">Patiëntgegevens (Altijd)</div>
              <div className="tutorial-real-body">
                Patiënt: <span className="tutorial-pill">Patiëntnaam</span><br/>
                Geboortedatum: <span className="tutorial-pill">Geboortedatum</span>
              </div>
            </div>
            <button className="tutorial-real-subsection">+ subsection</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContextTypesSection() {
  return (
    <div className="tutorial-section">
      <h1>Context Types</h1>
      <p>Elke sectie heeft een type dat bepaalt wanneer deze wordt getoond:</p>

      <div className="tutorial-real-sections spaced">
        <div className="tutorial-real-section always wide">
          <div className="tutorial-real-icon">—</div>
          <div className="tutorial-real-content">
            <div className="tutorial-real-title">Patiëntgegevens (Altijd)</div>
            <div className="tutorial-real-body">
              Patiënt: <span className="tutorial-pill">Patiëntnaam</span><br/>
              Geboortedatum: <span className="tutorial-pill">Geboortedatum</span>
            </div>
          </div>
        </div>
        <div className="tutorial-context-desc">
          <strong>Altijd</strong> — Sectie verschijnt altijd in de brief.
        </div>

        <div className="tutorial-real-section conditional wide">
          <div className="tutorial-real-icon">⎇</div>
          <div className="tutorial-real-content">
            <div className="tutorial-real-title">Allergieën (Als heeft allergieën)</div>
            <div className="tutorial-real-body">
              <strong>Waarschuwing:</strong> Patiënt heeft allergieën!<br/>
              Details: <span className="tutorial-pill">Allergie Details</span>
            </div>
          </div>
        </div>
        <div className="tutorial-context-desc">
          <strong>Conditioneel</strong> — Sectie verschijnt alleen als aan een voorwaarde wordt voldaan.
        </div>

        <div className="tutorial-real-section repeating wide">
          <div className="tutorial-real-icon">↻</div>
          <div className="tutorial-real-content">
            <div className="tutorial-real-title">Medicatie (Herhalend)</div>
            <div className="tutorial-real-body">
              • <span className="tutorial-pill">Medicatie Naam</span> (<span className="tutorial-pill">Medicatie Type</span>) - <span className="tutorial-pill">Dosis</span>
            </div>
          </div>
        </div>
        <div className="tutorial-context-desc">
          <strong>Herhalend</strong> — Sectie herhaalt voor elk item in een lijst (bijv. medicijnen).
        </div>
      </div>

      <div className="tutorial-tip">
        Klik op het gekleurde icoon om het type te wijzigen.
      </div>
    </div>
  );
}

function VariablesSection() {
  return (
    <div className="tutorial-section">
      <h1>Placeholders Invoegen</h1>
      <p>Placeholders halen waarden uit het formulier en plaatsen deze in je brief.</p>

      <div className="tutorial-demo-box">
        <h3>Een Placeholder Invoegen</h3>
        <p>Typ <kbd>%</kbd> om de veldkiezer te openen:</p>

        <div className="tutorial-editor-mock">
          <div className="tutorial-editor-content">
            Patiënt is gediagnosticeerd met <span className="tutorial-cursor">|</span>
          </div>
        </div>

        <div className="tutorial-completion-mock">
          <div className="tutorial-completion-header">Selecteer een veld:</div>
          <div className="tutorial-completion-item selected">
            <span className="tutorial-completion-label">Diagnose</span>
            <span className="tutorial-completion-detail">linkId: diagnose</span>
          </div>
          <div className="tutorial-completion-item">
            <span className="tutorial-completion-label">Patiëntnaam</span>
            <span className="tutorial-completion-detail">linkId: patient_naam</span>
          </div>
          <div className="tutorial-completion-item">
            <span className="tutorial-completion-label">Geboortedatum</span>
            <span className="tutorial-completion-detail">linkId: geboortedatum</span>
          </div>
        </div>
      </div>

      <div className="tutorial-demo-box">
        <h3>Resultaat</h3>
        <p>Na selectie verschijnt de variabele als een pill:</p>
        <div className="tutorial-editor-mock">
          <div className="tutorial-editor-content">
            Patiënt is gediagnosticeerd met <span className="tutorial-pill">Diagnose</span>
          </div>
        </div>
      </div>

      <div className="tutorial-tip">
        <strong>Tip:</strong> Begin met typen om de lijst te filteren. Gebruik de pijltjestoetsen om te navigeren en Enter om te selecteren.
      </div>
    </div>
  );
}

function FormattingSection() {
  return (
    <div className="tutorial-section">
      <h1>Opmaak & Filters</h1>
      <p>Klik op een placeholder om filters toe te voegen via de werkbalk.</p>

      <div className="tutorial-demo-box">
        <h3>De Editor met Filters</h3>
        <div className="tutorial-editor-ui">
          <div className="tutorial-format-toolbar">
            <span className="tutorial-format-label">Format:</span>
            <span className="tutorial-filter-chip">Suffix: cm <span className="tutorial-chip-x">×</span></span>
            <span className="tutorial-filter-chip">Map <span className="tutorial-chip-x">×</span></span>
            <span className="tutorial-filter-add">+ <span className="tutorial-chip-arrow">▾</span></span>
          </div>
          <div className="tutorial-editor-content-line">
            • <span className="tutorial-pill">Medicatie Naam</span>{" "}
            <span className="tutorial-pill selected">Medicatie Type || append || map</span>{" "}
            - <span className="tutorial-pill">Dosis</span>
          </div>
        </div>
      </div>

      <div className="tutorial-demo-box">
        <h3>Beschikbare Filters</h3>
        <table className="tutorial-filter-table">
          <thead>
            <tr><th>Filter</th><th>Beschrijving</th><th>Voorbeeld</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>Prefix</code></td>
              <td>Tekst vóór de waarde</td>
              <td>"Dr. " + Jansen → Dr. Jansen</td>
            </tr>
            <tr>
              <td><code>Suffix</code></td>
              <td>Tekst na de waarde</td>
              <td>500 + " mg" → 500 mg</td>
            </tr>
            <tr>
              <td><code>Hoofdletters</code></td>
              <td>Alles in hoofdletters</td>
              <td>hallo → HALLO</td>
            </tr>
            <tr>
              <td><code>Kleine letters</code></td>
              <td>Alles in kleine letters</td>
              <td>HALLO → hallo</td>
            </tr>
            <tr>
              <td><code>Standaardwaarde</code></td>
              <td>Toon als veld leeg is</td>
              <td>(leeg) → N.v.t.</td>
            </tr>
            <tr>
              <td><code>Map</code></td>
              <td>Vertaal codes naar tekst</td>
              <td>M → Man, V → Vrouw</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="tutorial-tip">
        <strong>Tip:</strong> Filters worden in volgorde toegepast. Je kunt meerdere filters combineren op één placeholder.
      </div>
    </div>
  );
}

function SaveWorkSection() {
  return (
    <div className="tutorial-section">
      <h1>Werk Opslaan</h1>
      <p>
        Dit is een playground omgeving. Je wijzigingen worden <strong>niet automatisch opgeslagen</strong> wanneer je de pagina verlaat.
      </p>

      <div className="tutorial-demo-box">
        <h3>De Werkbalk</h3>
        <div className="tutorial-toolbar-mock">
          <span className="tutorial-toolbar-title">COMPOSITION</span>
          <div className="tutorial-toolbar-buttons">
            <span className="tutorial-toolbar-btn">{"{ }"}</span>
            <span className="tutorial-toolbar-btn">Clear</span>
            <span className="tutorial-toolbar-btn">Import</span>
            <span className="tutorial-toolbar-btn">Export</span>
          </div>
        </div>
      </div>

      <div className="tutorial-demo-box">
        <h3>Knoppen</h3>
        <table className="tutorial-filter-table">
          <tbody>
            <tr>
              <td><strong>{"{ }"}</strong></td>
              <td>Bekijk de ruwe JSON van je compositie</td>
            </tr>
            <tr>
              <td><strong>Clear</strong></td>
              <td>Verwijder alle secties en begin opnieuw</td>
            </tr>
            <tr>
              <td><strong>Import</strong></td>
              <td>Laad een eerder geëxporteerde compositie (JSON bestand)</td>
            </tr>
            <tr>
              <td><strong>Export</strong></td>
              <td>Download je compositie als JSON bestand om later verder te werken</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="tutorial-tip">
        <strong>Tip:</strong> Exporteer je werk regelmatig! Zo kun je altijd verder waar je gebleven was.
      </div>
    </div>
  );
}
