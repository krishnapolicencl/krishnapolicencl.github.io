/* ------------------------------------------------------------------
   SETTINGS — edit this file when stations or the repository change.
   ------------------------------------------------------------------ */
window.NCL_CONFIG = {
  /* Headings */
  unitName: "KRISHNA DISTRICT POLICE",
  appTitle: "NEW CRIMINAL LAWS - 60 & 90 DAYS CASES",
  fromDate: "01-07-2024",            // shown in the abstract title
  credit: "Designed & Developed by Kola.Bapuji, IT Core Team, Chittoor",

  /* Web app URL of the Google Apps Script (ends with /exec).
     Paste it between the quotes after deploying Code.gs
     (deploy it from the Krishna district Google account). */
  apiUrl: "",

  /* Sub-divisions and their police stations, in the order they appear
     in the abstract (same as the SD sheet). */
  subDivisions: [
    { code: "AVG", title: "AVANIGADDA SUB DIVISION", totalLabel: "AVANIGADDA SD TOTAL",
      stations: ["Nagayalanka", "Avanigadda", "Koduru", "Challapalli", "Ghantasala"] },
    { code: "GDV", title: "GUDIVADA SUB DIVISION", totalLabel: "GUDIVADA SD TOTAL",
      stations: ["Gudivada I Town UPS", "Gudivada II Town UPS", "Nandivada", "Gudivada Rural",
                 "Gudlavalleru", "Pedaparupudi", "Pamarru", "Kuchipudi", "Thotlavalluru",
                 "Pamidimukkala"] },
    { code: "GVM", title: "GANNAVARAM SUB DIVISION", totalLabel: "GANNAVARAM SD TOTAL",
      stations: ["Vuyyuru Town UPS", "Penamaluru UPS", "Gannavaram UPS", "Unguturu",
                 "Hanuman Junction", "Atkuru", "Veeravalli", "Vuyyuru Rural", "Kankipadu"] },
    { code: "MTM", title: "MACHILIPATNAM SUB DIVISION", totalLabel: "MACHILIPATNAM SD TOTAL",
      stations: ["Inaguduru UPS", "Chilakalapudi UPS", "Robertsonpet", "Bantumilli", "Guduru",
                 "Pedana", "Kruthivennu", "Bandar Taluk PS", "Machilipatnam Town"] },
    { code: "OTHERS", title: "OTHERS", totalLabel: "OTHERS TOTAL",
      stations: ["Mahila UPS, Machilipatnam"] }
  ],

  /* In the printed / PDF abstract, page 1 ends after this sub-division. */
  abstractPageBreakAfter: "GDV",

  /* Rows of these stations are removed while importing. Add names here if needed. */
  excludeStations: []
};
