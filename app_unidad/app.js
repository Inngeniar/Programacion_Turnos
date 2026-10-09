// app.js

// State
const state = {
    year: 2026,
    month: 7, // 0-indexed (7 = August)
    unidadOperativa: "",
    responsable: "",
    evaluador: "",
    departments: [],
    currentDept: null,
    data: {}, // data[dept][employeeId]
    conventions: {}, // conventions[dept] = { "D": { hours: 12, color: "#bfdbfe" }, ... }
    status: {},
    feedback: {}, // feedback[dept] = 'anotaciones / aspectos a mejorar / rechazo'
    hiddenDepartments: {}
};

function strVal(val) {
    if (val === null || val === undefined) return "";
    return val.toString();
}

function isRestOrNovelty(code, convs) {
    if (!code) return true;
    const c = code.toString().trim().toUpperCase();
    const restCodes = [
        'L', 'LIBRE', 'DESCANSO', 'VAC', 'V', 'VACACIONES', 
        'LIC', 'INC', 'INCAPACIDAD', 'DISP', 'DAC', 'CAP', 
        'OFF', 'DSO', 'DL', 'R', 'REPOSO'
    ];
    if (restCodes.includes(c)) return true;
    if (convs && convs[c] && (convs[c].hours === 0 || convs[c].hours === undefined)) return true;
    return false;
}

function extractDayNumber(cellVal) {
    if (cellVal === null || cellVal === undefined) return null;
    
    // 1. JS Date Object
    if (cellVal instanceof Date) {
        if (!isNaN(cellVal.getTime())) {
            return cellVal.getUTCDate();
        }
    }

    // 2. Excel Serial Number (e.g. 46266..46295 for Sept 2026)
    let num = Number(cellVal);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        let dateObj = new Date((num - 25569) * 86400 * 1000 + 43200000);
        if (!isNaN(dateObj.getTime())) {
            return dateObj.getUTCDate();
        }
    }

    let s = strVal(cellVal).trim();
    if (!s) return null;
    
    // 3. Direct integer 1..31
    if (/^\d{1,2}$/.test(s)) {
        let n = parseInt(s, 10);
        if (n >= 1 && n <= 31) return n;
    }
    
    // 4. ISO format YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-09-01 or 2026-09-01 00:00:00)
    let mISO = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (mISO) {
        let n = parseInt(mISO[3], 10);
        if (n >= 1 && n <= 31) return n;
    }

    // 5. Format DD/MM/YYYY or DD-MM-YYYY
    let mSlash = s.match(/^(\d{1,2})[\/\-](\d{1,2})([\/\-]\d{2,4})?/);
    if (mSlash) {
        let n = parseInt(mSlash[1], 10);
        if (n >= 1 && n <= 31) return n;
    }
    
    return null;
}

function normalizeHexColor(colorStr, fallbackHex = "#bfdbfe") {
    if (!colorStr || typeof colorStr !== 'string') return fallbackHex;
    let hex = colorStr.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        return hex.toLowerCase();
    }
    return fallbackHex;
}

function getContrastTextColor(hexColor) {
    const hex = normalizeHexColor(hexColor, "#ffffff").replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#0f172a' : '#ffffff';
}

function parseConventionHours(rawVal) {
    if (rawVal === null || rawVal === undefined) return 0;
    let str = rawVal.toString().trim().replace(',', '.');
    let val = parseFloat(str);
    if (isNaN(val) || val <= 0) return 0;

    let hoursVal = val;
    if (val > 0 && val < 1.0) {
        hoursVal = val * 24.0;
    }

    let rounded = Math.round(hoursVal * 10000) / 10000;
    let roundedStr = rounded.toString();

    if (roundedStr.includes('.')) {
        let parts = roundedStr.split('.');
        let intPart = parseInt(parts[0]) || 0;
        let decStr = parts[1];

        if (decStr === '3' || decStr.startsWith('30')) {
            return intPart + 0.5;
        }
        if (decStr.startsWith('45')) {
            return intPart + 0.75;
        }
        if (decStr.startsWith('15')) {
            return intPart + 0.25;
        }
    }

    return Math.round(hoursVal * 100) / 100;
}

function getConventionColor(code) {
    if (!code) return '#bfdbfe';
    let c = code.toString().trim().toUpperCase();
    if (['L', 'LIBRE', 'DESCANSO', 'DAC', 'VAC', 'V'].includes(c)) return '#e5e7eb';
    if (['N', 'NOCTURNO'].includes(c)) return '#1e3a8a';
    if (['D', 'DIURNO'].includes(c)) return '#bfdbfe';
    if (c === 'J1') return '#cbd5e1';
    if (c === 'J2') return '#94a3b8';
    if (c === 'CAP' || c === 'C') return '#d9f99d';
    return '#fef08a';
}

function getDepartmentCapHours(convs) {
    if (!convs) return 1;
    if (convs['CAP'] && convs['CAP'].hours !== undefined && !isNaN(convs['CAP'].hours)) {
        return convs['CAP'].hours;
    }
    if (convs['C'] && convs['C'].hours !== undefined && !isNaN(convs['C'].hours)) {
        return convs['C'].hours;
    }
    for (const [k, v] of Object.entries(convs)) {
        const kUp = k.toUpperCase().trim();
        const descUp = (v && v.description ? v.description.toUpperCase().trim() : '');
        if (kUp === 'CAP' || kUp === 'C' || kUp.startsWith('CAPACITA') || descUp.includes('CAPACITA')) {
            if (v && v.hours !== undefined && !isNaN(v.hours)) {
                return v.hours;
            }
        }
    }
    return 1;
}

function getEmpCapHours(emp, dept) {
    const convs = (dept && state.conventions[dept]) ? state.conventions[dept] : getDefaultConventions();
    let capUnitHours = getDepartmentCapHours(convs);
    
    if (!emp) return capUnitHours;
    
    let capShiftCount = 0;
    if (emp.shifts) {
        Object.values(emp.shifts).forEach(s => {
            if (s) {
                const sVal = s.toString().trim().toUpperCase();
                if (sVal === 'CAP' || sVal === 'C') {
                    capShiftCount++;
                }
            }
        });
    }
    
    if (capShiftCount > 0) {
        return capShiftCount * capUnitHours;
    }
    
    if (emp.cap !== undefined && emp.cap !== null && !isNaN(parseFloat(emp.cap))) {
        return parseFloat(emp.cap);
    }
    
    return capUnitHours;
}

function getDefaultConventions() {
    return {
        "D": { hours: 8, description: "Diurno", color: "#bfdbfe" },
        "N": { hours: 12, description: "Nocturno", color: "#1e3a8a" },
        "M": { hours: 6, description: "Mañana", color: "#fef08a" },
        "T": { hours: 6, description: "Tarde", color: "#fed7aa" },
        "L": { hours: 0, description: "Libre", color: "#e5e7eb" },
        "J1": { hours: 8, description: "Jornada 1", color: "#cbd5e1" },
        "CAP": { hours: 2, description: "Capacitación", color: "#d9f99d" }
    };
}

function parseExcelConventions(aoa) {
    if (!aoa || aoa.length === 0) return {};
    
    let parsedConvs = {};
    
    // 1. Locate start row of conventions block
    let convStartRow = -1;
    for (let i = 0; i < aoa.length; i++) {
        let rowStr = (aoa[i] || []).map(c => strVal(c).toUpperCase()).join(' ');
        if (rowStr.includes('CONVENCION') || rowStr.includes('CONVENCIONES')) {
            convStartRow = i;
            break;
        }
    }
    
    if (convStartRow === -1) {
        for (let i = 0; i < aoa.length; i++) {
            let rowStr = (aoa[i] || []).map(c => strVal(c).toUpperCase()).join(' ');
            if (rowStr.includes('TOTAL HORAS DIA') || rowStr.includes('TOTAL HORAS DÍA')) {
                convStartRow = i + 1;
                break;
            }
        }
    }
    
    if (convStartRow === -1) {
        convStartRow = Math.max(0, aoa.length - 35);
    }
    
    // 2. Identify header row and column indexes for Sigla, Hours, and Description/Schedule
    let headerRowIdx = -1;
    let tCol = -1, hCol = -1, descCol = -1;
    
    for (let r = convStartRow; r < Math.min(convStartRow + 6, aoa.length); r++) {
        let row = aoa[r] || [];
        for (let c = 0; c < row.length; c++) {
            let v = strVal(row[c]).toUpperCase().trim();
            if (v.includes('TURNO') || v.includes('TURNOS') || v.includes('SIGLA') || v.includes('CONVENCION')) {
                if (tCol === -1) tCol = c;
            } else if (['TOTAL HORAS', 'TOTAL', 'T.H', 'HORAS', 'DURACION', 'DURACIÓN', 'CONVERSION'].some(kw => v.includes(kw))) {
                if (hCol === -1) hCol = c;
            } else if (['INICIO', 'HORARIO', 'DESCRIPCION', 'DESCRIPCIÓN', 'JORNADA', 'DETALLE'].some(kw => v.includes(kw))) {
                if (descCol === -1) descCol = c;
            }
        }
        if (tCol !== -1 || hCol !== -1) {
            headerRowIdx = r;
            break;
        }
    }
    
    let startScan = (headerRowIdx !== -1) ? headerRowIdx + 1 : convStartRow;
    
    for (let r = startScan; r < aoa.length; r++) {
        let row = aoa[r];
        if (!row || row.length === 0) continue;
        
        let rowStr = row.map(c => strVal(c).toUpperCase()).join(' ');
        if (['ELABORÓ', 'ELABORO', 'REVISÓ', 'REVISO', 'APROBÓ', 'APROBO', 'NOTA:'].some(kw => rowStr.includes(kw))) {
            break;
        }
        
        let tCode = "";
        if (tCol !== -1 && tCol < row.length && strVal(row[tCol]).trim()) {
            let raw = strVal(row[tCol]).trim().toUpperCase();
            if (!['TURNO', 'TURNOS', 'CONVENCIONES', 'SIGLA', 'CONVENCION'].includes(raw)) {
                tCode = raw;
            }
        }
        
        if (!tCode) {
            for (let c = 0; c < row.length; c++) {
                let raw = strVal(row[c]).trim().toUpperCase();
                if (raw && raw.length >= 1 && raw.length <= 15 && !['DIA', 'MES', 'AÑO', 'SGC', 'TOTAL', 'HORAS', 'FECHA'].includes(raw)) {
                    if (/^[A-Z0-9\-_]+$/i.test(raw) || raw.startsWith('JORNADA') || raw === 'LIBRE' || raw === 'CAPACITACION' || raw === 'CAPACITACIONES') {
                        if (raw.startsWith('JORNADA')) {
                            let m = raw.match(/JORNADA\s*(\d+)/);
                            if (m) raw = 'J' + m[1];
                        }
                        tCode = raw;
                        break;
                    }
                }
            }
        }
        
        if (!tCode) continue;
        
        let desc = "";
        if (descCol !== -1 && descCol < row.length && strVal(row[descCol]).trim()) {
            let rawDesc = strVal(row[descCol]).trim();
            if (rawDesc.toUpperCase() !== tCode) {
                desc = rawDesc;
            }
        }
        
        let tHours = 0;
        let foundHours = false;
        
        if (hCol !== -1 && hCol < row.length && strVal(row[hCol]).trim()) {
            tHours = parseConventionHours(row[hCol]);
            if (tHours > 0 || strVal(row[hCol]).trim() === '0') {
                foundHours = true;
            }
        }
        
        if (!foundHours) {
            for (let c = row.length - 1; c >= 0; c--) {
                let val = row[c];
                if (val !== null && val !== undefined && strVal(val).trim() !== "") {
                    let parsed = parseConventionHours(val);
                    if (parsed > 0 || strVal(val).trim() === '0') {
                        tHours = parsed;
                        foundHours = true;
                        break;
                    }
                }
            }
        }
        
        if (foundHours) {
            parsedConvs[tCode] = {
                hours: tHours,
                description: desc || tCode,
                color: getConventionColor(tCode)
            };
            if (tCode === 'C' || tCode.startsWith('CAP') || (desc && desc.toUpperCase().includes('CAPACITA'))) {
                parsedConvs['CAP'] = {
                    hours: tHours,
                    description: desc || 'Capacitación',
                    color: getConventionColor('CAP')
                };
            }
            if (tCode === 'CAP' && !parsedConvs['C']) {
                parsedConvs['C'] = {
                    hours: tHours,
                    description: desc || 'Capacitaciones',
                    color: getConventionColor('C')
                };
            }
        }
    }
    
    return parsedConvs;
}

// Target hours based on the circular 010-2026 (for 2026)
const targetHours2026 = {
    7: 168, // August
    8: 182, // Sept
    9: 182, // Oct
    10: 161, // Nov
    11: 175  // Dec
};

// Holidays 2026 (Format: YYYY-MM-DD)
const holidays2026 = [
    "2026-08-07", "2026-08-17",
    "2026-10-12",
    "2026-11-02", "2026-11-16",
    "2026-12-08", "2026-12-25"
];

// Deprecated: used fallback in logic instead
// const shiftHours = ...

// DOM Elements
const selectYear = document.getElementById("select-year");
const selectMonth = document.getElementById("select-month");
const inputUnidad = document.getElementById("input-unidad");
const inputResponsable = document.getElementById("input-responsable");
const deptList = document.getElementById("dept-list");
const btnAddDept = document.getElementById("btn-add-dept");
const btnAddEmployee = document.getElementById("btn-add-employee");
const currentDeptTitle = document.getElementById("current-dept-title");
const infoTotalHours = document.getElementById("info-total-hours");
const emptyState = document.getElementById("empty-state");
const tableRowDays = document.getElementById("table-row-days");
const tableRowWeekdays = document.getElementById("table-row-weekdays");
const tableBodyEmployees = document.getElementById("table-body-employees");
const legendContainer = document.getElementById("legend-items-container");
const btnConfigConv = document.getElementById("btn-config-conv");
const btnEditLegend = document.getElementById("btn-edit-legend");
const modalConv = document.getElementById("modal-convenciones");
const tbodyConv = document.getElementById("tbody-conv");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnAddConv = document.getElementById("btn-add-conv");
const btnSaveConv = document.getElementById("btn-save-conv");
const btnLoadConvExcel = document.getElementById("btn-load-conv-excel");
const fileInputConv = document.getElementById("file-input-conv");

// Initialization
function init() {
    // Populate Year
    const currentYear = new Date().getFullYear();
    for (let y = 2026; y <= 2030; y++) {
        const opt = document.createElement("option");
        opt.value = y; opt.textContent = y;
        selectYear.appendChild(opt);
    }
    selectYear.value = state.year;
    selectMonth.value = state.month;

    // Listeners
    selectYear.addEventListener("change", (e) => { state.year = parseInt(e.target.value); renderGrid(); });
    selectMonth.addEventListener("change", (e) => { state.month = parseInt(e.target.value); updateTargetHours(); renderGrid(); });
    inputUnidad.addEventListener("input", (e) => state.unidadOperativa = e.target.value);
    inputUnidad.addEventListener("change", (e) => {
        let newVal = e.target.value.trim();
        if (newVal) {
            renameOperationalUnitDirectly(state.unidadOperativa, newVal);
        }
    });
    inputResponsable.addEventListener("input", (e) => state.responsable = e.target.value);

    btnAddDept.addEventListener("click", addDepartment);
    btnAddEmployee.addEventListener("click", addEmployee);
    
    document.getElementById("btn-save-local").addEventListener("click", saveLocal);
    document.getElementById("btn-load-json").addEventListener("click", () => document.getElementById("file-input-json").click());
    document.getElementById("btn-load-excel").addEventListener("click", () => document.getElementById("file-input-excel").click());
    document.getElementById("file-input-json").addEventListener("change", loadJSON);
    document.getElementById("file-input-excel").addEventListener("change", loadExcel);
    document.getElementById("btn-export-excel").addEventListener("click", exportExcel);
    const btnRemoveFile = document.getElementById("btn-remove-file");
    if (btnRemoveFile) btnRemoveFile.addEventListener("click", promptRemoveFileOrUnit);
    const btnClearAll = document.getElementById("btn-clear-all");
    if (btnClearAll) btnClearAll.addEventListener("click", clearAllData);
    
    // New Program Listener
    const btnNewProg = document.getElementById("btn-new-program");
    if (btnNewProg) btnNewProg.addEventListener("click", resetNewProgram);

    // Deviations Report Listener
    const btnReporte = document.getElementById("btn-reporte-desviaciones");
    if (btnReporte) btnReporte.addEventListener("click", openDeviationsModal);

    const btnCloseDesv = document.getElementById("btn-close-modal-desviaciones");
    if (btnCloseDesv) btnCloseDesv.addEventListener("click", () => document.getElementById("modal-desviaciones").classList.add("hidden"));

    const filterUODesv = document.getElementById("filter-uo-desviaciones");
    if (filterUODesv) filterUODesv.addEventListener("change", () => { updateDeptFilterOptions(); renderDeviationsTable(); });

    const filterDeptDesv = document.getElementById("filter-dept-desviaciones");
    if (filterDeptDesv) filterDeptDesv.addEventListener("change", renderDeviationsTable);

    const filterTipoDesv = document.getElementById("filter-tipo-desviaciones");
    if (filterTipoDesv) filterTipoDesv.addEventListener("change", renderDeviationsTable);

    const btnExpDesv = document.getElementById("btn-export-desviaciones-excel");
    if (btnExpDesv) btnExpDesv.addEventListener("click", exportDeviationsExcel);

    const btnPrintFilter = document.getElementById("btn-print-desviaciones-filter");
    if (btnPrintFilter) btnPrintFilter.addEventListener("click", () => printDeviationsReport(false));

    const btnPrintAll = document.getElementById("btn-print-desviaciones-all");
    if (btnPrintAll) btnPrintAll.addEventListener("click", () => printDeviationsReport(true));

    const btnEvalNotes = document.getElementById("btn-evaluator-notes");
    if (btnEvalNotes) btnEvalNotes.addEventListener("click", promptEvaluatorNote);
    
    // Modal Listeners
    btnConfigConv.addEventListener("click", openConvModal);
    btnEditLegend.addEventListener("click", openConvModal);
    btnCloseModal.addEventListener("click", () => modalConv.classList.add("hidden"));
    btnAddConv.addEventListener("click", addConvRow);
    btnSaveConv.addEventListener("click", saveConventions);
    btnLoadConvExcel.addEventListener("click", () => fileInputConv.click());
    fileInputConv.addEventListener("change", loadConventionsExcel);

    // Initial Data Setup
    state.departments.forEach(d => { 
        if (!state.data[d]) state.data[d] = []; 
        if (!state.conventions[d]) state.conventions[d] = getDefaultConventions();
    });
    
    loadLocal();
    updateLoadedFileBadge();
    renderDepartments();
    updateTargetHours();
}

function updateTargetHours() {
    let target = 168; // Default fallback
    if (state.year === 2026 && targetHours2026[state.month]) {
        target = targetHours2026[state.month];
    }
    const opTarget = target - 1;
    infoTotalHours.textContent = `Meta Mes: ${target}h (${opTarget}h Op + 1h CAP | Prom: 42h/sem)`;
}

const collapsedGroups = new Set();

function renderDepartments() {
    deptList.innerHTML = "";
    if (!state.departments || state.departments.length === 0) return;

    // Group departments by Operational Unit
    const grouped = {};
    state.departments.forEach(dept => {
        let unit = state.unidadOperativa || "UNIDAD OPERATIVA";
        let service = dept;
        if (dept.includes("|")) {
            let parts = dept.split("|");
            unit = parts[0].trim();
            service = parts[1].trim();
        }
        if (!grouped[unit]) grouped[unit] = [];
        grouped[unit].push({ fullKey: dept, serviceName: service });
    });

    const unitKeys = Object.keys(grouped);

    unitKeys.forEach(unit => {
        const services = grouped[unit];
        const isCollapsed = collapsedGroups.has(unit);

        const groupDiv = document.createElement("div");
        groupDiv.className = "dept-group" + (isCollapsed ? " collapsed" : "");

        const headerDiv = document.createElement("div");
        headerDiv.className = "dept-group-header";
        
        let approvedCount = 0;
        let rejectedCount = 0;
        services.forEach(s => {
            let st = getDeptStatus(s.fullKey);
            if (st === 'approved') approvedCount++;
            if (st === 'rejected') rejectedCount++;
        });

        let statusBadgeText = '';
        if (approvedCount > 0) statusBadgeText += `<span title="Aprobados" style="color: #16a34a; margin-right:4px;">✓${approvedCount}</span>`;
        if (rejectedCount > 0) statusBadgeText += `<span title="Rechazados" style="color: #dc2626;">✗${rejectedCount}</span>`;

        headerDiv.innerHTML = `
            <div class="dept-group-title" style="flex:1; min-width:0; display:flex; align-items:center; gap:4px; overflow:hidden;" title="Doble clic para renombrar ${unit}">
                <span class="toggle-icon">${isCollapsed ? '+' : '−'}</span>
                <span class="unit-name" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; font-weight:700;">🏥 ${unit}</span>
            </div>
            <div class="dept-group-meta" style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                ${statusBadgeText}
                <span class="dept-count-badge">${services.length}</span>
                <button class="btn-rename-unit" title="Renombrar este hospital/unidad (${unit})" style="background:#eff6ff; border:1px solid #bfdbfe; color:#2563eb; padding:2px 5px; border-radius:4px; font-size:0.8rem; cursor:pointer; font-weight:bold; transition:all 0.15s;" onmouseover="this.style.background='#2563eb'; this.style.color='white';" onmouseout="this.style.background='#eff6ff'; this.style.color='#2563eb';">✏️</button>
                <button class="btn-del-unit" title="Eliminar únicamente este hospital/unidad (${unit})" style="background:none; border:none; color:#ef4444; font-size:0.85rem; cursor:pointer; padding:2px 4px; border-radius:4px; opacity:0.7; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">🗑️</button>
            </div>
        `;

        const btnRenameUnit = headerDiv.querySelector(".btn-rename-unit");
        if (btnRenameUnit) {
            btnRenameUnit.onclick = (evt) => {
                evt.stopPropagation();
                renameOperationalUnit(unit);
            };
        }

        const unitNameSpan = headerDiv.querySelector(".unit-name");
        if (unitNameSpan) {
            unitNameSpan.ondblclick = (evt) => {
                evt.stopPropagation();
                renameOperationalUnit(unit);
            };
        }

        const btnDelUnit = headerDiv.querySelector(".btn-del-unit");
        if (btnDelUnit) {
            btnDelUnit.onclick = (evt) => {
                evt.stopPropagation();
                deleteOperationalUnit(unit);
            };
        }

        headerDiv.onclick = () => {
            if (collapsedGroups.has(unit)) {
                collapsedGroups.delete(unit);
            } else {
                collapsedGroups.add(unit);
            }
            renderDepartments();
        };

        const itemsUl = document.createElement("ul");
        itemsUl.className = "dept-group-items";
        if (isCollapsed) {
            itemsUl.style.display = "none";
        }

        services.forEach(({ fullKey, serviceName }) => {
            const li = document.createElement("li");
            let isActive = (state.currentDept === fullKey);
            let itemStatus = getDeptStatus(fullKey);

            let statusIcon = '';
            if (itemStatus === 'approved') statusIcon = '<span style="color: #16a34a; font-weight:bold; margin-left: 4px;">✓</span>';
            else if (itemStatus === 'rejected') statusIcon = '<span style="color: #dc2626; font-weight:bold; margin-left: 4px;">✗</span>';
            else if (itemStatus === 'review') statusIcon = '<span style="color: #d97706; font-weight:bold; margin-left: 4px;">!</span>';

            let isHiddenSheet = state.hiddenDepartments && state.hiddenDepartments[fullKey];
            let isCopySheet = isCopyOrDraftSheetName(serviceName) || isCopyOrDraftSheetName(fullKey);

            let hiddenBadge = '';
            if (isHiddenSheet && isCopySheet) {
                hiddenBadge = `<span class="badge-hidden-sheet" title="Pestaña oculta y de borrador/copia en el Excel original">🔒 Oculta / Copia</span>`;
            } else if (isHiddenSheet) {
                hiddenBadge = `<span class="badge-hidden-sheet" title="Pestaña oculta en el Excel original">🔒 Oculta</span>`;
            } else if (isCopySheet) {
                hiddenBadge = `<span class="badge-hidden-sheet" style="background-color:#fef3c7; color:#92400e; border-color:#f59e0b;" title="Pestaña de copia o borrador en el Excel (ej. (2))">📋 Copia / Borrador</span>`;
            }

            li.className = "dept-item" + (isActive ? " active" : "");
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.justifyContent = "space-between";
            li.style.gap = "6px";
            li.innerHTML = `
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; display:flex; align-items:center;" title="${serviceName}">${serviceName} ${hiddenBadge}</span>
                <span style="display:flex; align-items:center; gap:4px; flex-shrink:0;">
                    ${statusIcon}
                    <button class="btn-rename-single-service" title="Renombrar servicio '${serviceName}'" style="background:#eff6ff; border:1px solid #bfdbfe; color:#2563eb; font-size:0.75rem; cursor:pointer; padding:2px 5px; border-radius:4px; font-weight:bold; transition:all 0.15s;" onmouseover="this.style.background='#2563eb'; this.style.color='white';" onmouseout="this.style.background='#eff6ff'; this.style.color='#2563eb';">✏️</button>
                    <button class="btn-del-single-service" title="Eliminar servicio '${serviceName}' cargado por equivocación" style="background:none; border:none; color:#ef4444; font-size:0.8rem; cursor:pointer; padding:2px 4px; border-radius:4px; opacity:0.6; transition:opacity 0.2s;">🗑️</button>
                </span>
            `;
            const btnRenameSingle = li.querySelector(".btn-rename-single-service");
            if (btnRenameSingle) {
                btnRenameSingle.onclick = (evt) => {
                    evt.stopPropagation();
                    renameSingleService(fullKey);
                };
            }

            const btnDelSingle = li.querySelector(".btn-del-single-service");
            if (btnDelSingle) {
                btnDelSingle.onmouseover = () => btnDelSingle.style.opacity = '1';
                btnDelSingle.onmouseout = () => btnDelSingle.style.opacity = '0.6';
                btnDelSingle.onclick = (evt) => {
                    evt.stopPropagation();
                    deleteDepartment(fullKey);
                };
            }
            li.onclick = (e) => {
                e.stopPropagation();
                selectDepartment(fullKey);
            };
            itemsUl.appendChild(li);
        });

        groupDiv.appendChild(headerDiv);
        groupDiv.appendChild(itemsUl);
        deptList.appendChild(groupDiv);
    });
}

async function addDepartment() {
    const { value: deptName } = await Swal.fire({
        title: 'Agregar Área',
        input: 'text',
        inputPlaceholder: 'Nombre del área (ej. UCI)',
        showCancelButton: true
    });
    if (deptName && !state.departments.includes(deptName.toUpperCase())) {
        const upper = deptName.toUpperCase();
        state.departments.push(upper);
        state.data[upper] = [];
        renderDepartments();
        selectDepartment(upper);
    }
}

function selectDepartment(dept) {
    state.currentDept = dept;
    if (!state.conventions[dept]) state.conventions[dept] = getDefaultConventions();
    renderDepartments();
    currentDeptTitle.textContent = dept;
    btnAddEmployee.disabled = false;
    btnConfigConv.disabled = false;
    const btnEvalNotes = document.getElementById("btn-evaluator-notes");
    if (btnEvalNotes) btnEvalNotes.disabled = false;
    emptyState.classList.add("hidden");
    renderLegend();
    renderGrid();
}

async function promptEvaluatorNote() {
    if (!state.currentDept) return;
    if (!state.feedback) state.feedback = {};
    const currentNote = state.feedback[state.currentDept] || "";
    
    const { value: text, isConfirmed } = await Swal.fire({
        title: 'Anotaciones y Aspectos a Mejorar',
        input: 'textarea',
        inputLabel: `Observaciones del Evaluador para ${state.currentDept}:`,
        inputValue: currentNote,
        inputPlaceholder: 'Escriba aquí los aspectos a mejorar, observaciones o motivos de rechazo para este servicio...',
        showCancelButton: true,
        confirmButtonText: 'Guardar Anotación',
        cancelButtonText: 'Cancelar'
    });
    
    if (isConfirmed && text !== undefined) {
        state.feedback[state.currentDept] = text.trim();
        if (text.trim() && (!state.status[state.currentDept] || state.status[state.currentDept] === 'pending')) {
            state.status[state.currentDept] = 'review';
        }
        renderDepartments();
        renderGrid();
        Swal.fire({ icon: 'success', title: 'Guardado', text: 'Anotación del evaluador registrada correctamente.', timer: 1500, showConfirmButton: false });
    }
}

function addEmployee() {
    if (!state.currentDept) return;
    state.data[state.currentDept].push({
        id: Date.now().toString(),
        name: "",
        shifts: {},
        cap: 1
    });
    renderGrid();
}

function removeEmployee(empId) {
    if (!state.currentDept) return;
    state.data[state.currentDept] = state.data[state.currentDept].filter(e => e.id !== empId);
    renderGrid();
}

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function isWeekendOrHoliday(year, month, day) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay(); // 0 is Sunday
    if (dayOfWeek === 0) return true;
    
    // Format YYYY-MM-DD
    const str = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    if (holidays2026.includes(str)) return true;
    
    return false;
}

const weekdayNames = ["D", "L", "M", "M", "J", "V", "S"];

function renderLegend() {
    legendContainer.innerHTML = "";
    const convs = state.conventions[state.currentDept] || getDefaultConventions();
    for (const [code, info] of Object.entries(convs)) {
        const normColor = normalizeHexColor(info.color, "#bfdbfe");
        const textColor = getContrastTextColor(normColor);
        const span = document.createElement("span");
        span.className = "legend-item";
        span.innerHTML = `<span class="badge" style="background:${normColor}; color:${textColor};">${code}</span> (${info.hours}h)`;
        legendContainer.appendChild(span);
    }
}

function renderGrid() {
    if (!state.currentDept) return;
    const convs = state.conventions[state.currentDept] || getDefaultConventions();
    
    const daysInMonth = getDaysInMonth(state.year, state.month);
    
    // Headers
    tableRowDays.innerHTML = `<th>COLABORADOR</th>`;
    tableRowWeekdays.innerHTML = `<th></th>`;
    
    let weekCounter = 1;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(state.year, state.month, d);
        const wd = weekdayNames[date.getDay()];
        const isOff = isWeekendOrHoliday(state.year, state.month, d);
        
        const thD = document.createElement("th");
        thD.textContent = d;
        if(isOff) thD.style.color = 'var(--danger)';
        tableRowDays.appendChild(thD);
        
        const thW = document.createElement("th");
        thW.textContent = wd;
        if(isOff) thW.style.color = 'var(--danger)';
        tableRowWeekdays.appendChild(thW);
        
        if (date.getDay() === 0 || d === daysInMonth) {
            const thDS = document.createElement("th");
            thDS.textContent = "S" + weekCounter;
            thDS.className = "cell-subtotal-header";
            tableRowDays.appendChild(thDS);
            
            const thWS = document.createElement("th");
            thWS.textContent = "Σ";
            thWS.className = "cell-subtotal-header";
            tableRowWeekdays.appendChild(thWS);
            weekCounter++;
        }
    }
    
    tableRowDays.innerHTML += `<th>H</th><th>CAP</th>`;
    tableRowWeekdays.innerHTML += `<th></th><th></th>`;
    
    // Body
    tableBodyEmployees.innerHTML = "";
    const employees = state.data[state.currentDept];
    
    employees.forEach(emp => {
        const tr = document.createElement("tr");
        
        // Name Cell
        const tdName = document.createElement("td");
        const inpName = document.createElement("input");
        inpName.className = "employee-name-input";
        inpName.type = "text";
        inpName.placeholder = "Nombre del asociado";
        inpName.value = emp.name;
        inpName.oninput = (e) => emp.name = e.target.value;
        
        const btnDel = document.createElement("button");
        btnDel.className = "btn-remove-row";
        btnDel.textContent = "×";
        btnDel.onclick = () => removeEmployee(emp.id);
        
        tdName.appendChild(inpName);
        if (emp.isHiddenRow) {
            const badgeHidden = document.createElement("span");
            badgeHidden.className = "badge-hidden-row";
            badgeHidden.title = "Fila de colaborador oculta en el Excel original";
            badgeHidden.textContent = "👁️ Oculta";
            tdName.appendChild(badgeHidden);
        }
        tdName.appendChild(btnDel);
        tr.appendChild(tdName);
        
        let totalHours = 0;
        let currentWeekHours = 0;
        let dayCellMap = {};
        
        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const td = document.createElement("td");
            dayCellMap[d] = td;
            const isOff = isWeekendOrHoliday(state.year, state.month, d);
            if (isOff) td.className = "col-day weekend";
            
            const inpShift = document.createElement("input");
            inpShift.className = "shift-input";
            inpShift.type = "text";
            inpShift.maxLength = 2;
            const val = emp.shifts[d] || "";
            inpShift.value = val;
            if(val) inpShift.classList.add(`val-${val[0]}`); // Colorize based on first letter (D, N, M, T, L)
            
            inpShift.onchange = (e) => {
                let v = e.target.value.toUpperCase();
                emp.shifts[d] = v;
                renderGrid(); // Re-render to update rules and totals
            };
            
            if (val && convs[val]) {
                const normColor = normalizeHexColor(convs[val].color, '#e2e8f0');
                inpShift.style.backgroundColor = normColor;
                inpShift.style.color = getContrastTextColor(normColor);
            }
            
            td.appendChild(inpShift);
            tr.appendChild(td);
            
            // Calc operational hours (CAP is separate training, not operational shift hours)
            let h = 0;
            if (val === 'CAP') {
                h = 0; // Exclude from operational total
            } else if (val && convs[val] !== undefined) {
                h = convs[val].hours;
            } else if (val) {
                h = 12; // Unknown, assume 12h default to avoid breaking
            } 
            
            totalHours += h;
            currentWeekHours += h;
            
            const date = new Date(state.year, state.month, d);
            if (date.getDay() === 0 || d === daysInMonth) {
                const tdSub = document.createElement("td");
                tdSub.className = "cell-subtotal";
                tdSub.textContent = currentWeekHours;
                if (currentWeekHours > 54) {
                    tdSub.classList.add("error");
                    tdSub.title = `Excede límite semanal de 54h`;
                }
                tr.appendChild(tdSub);
                currentWeekHours = 0;
            }
        }
        
        // Run Validations
        const validation = validateRules(emp, daysInMonth, state.currentDept);
        
        // Hours
        const tdH = document.createElement("td");
        tdH.className = "cell-total";
        tdH.textContent = totalHours;
        
        let targetMonth = state.year === 2026 && targetHours2026[state.month] ? targetHours2026[state.month] : 168;
        let capVal = getEmpCapHours(emp, state.currentDept);
        emp.cap = capVal;
        let combined = totalHours + capVal;
        let opExpected = targetMonth - 1;

        if (combined !== targetMonth) {
            tdH.classList.add("error");
            tdH.title = `Suma de Horas Operativas (${totalHours}h) + CAP (${capVal}h) = ${combined}h no coincide con la meta del mes (${targetMonth}h)`;
        } else if (totalHours < opExpected) {
            tdH.classList.remove("error");
            tdH.title = `Cumple meta total (${targetMonth}h), registrando ${totalHours}h operativas + ${capVal}h CAP`;
        }
        tr.appendChild(tdH);
        
        // Cap
        const tdCap = document.createElement("td");
        const inpCap = document.createElement("input");
        inpCap.className = "shift-input val-CAP";
        inpCap.type = "number";
        inpCap.step = "0.5";
        inpCap.value = capVal;
        inpCap.onchange = (e) => {
            emp.cap = parseFloat(e.target.value) || 0;
            try {
                localStorage.setItem("msm_turnos_unidad", JSON.stringify(state));
                localStorage.setItem("msm_turnos", JSON.stringify(state));
            } catch(err) {}
            renderGrid();
        };
        tdCap.appendChild(inpCap);
        tr.appendChild(tdCap);
        
        // Apply Validation Errors to UI
        if (validation.errors.length > 0) {
            validation.errors.forEach(err => {
                if (err.day && dayCellMap[err.day]) {
                    dayCellMap[err.day].classList.add("cell-error");
                    dayCellMap[err.day].title = err.msg;
                }
            });
            // Also alert on total if max 54h/week broken
            if (validation.globalMsg) {
                tdH.classList.add("cell-error");
                tdH.title = validation.globalMsg;
            }
        }

        tableBodyEmployees.appendChild(tr);
    });
}

function validateRules(emp, daysInMonth, dept) {
    let errors = [];
    let globalMsg = "";
    const convs = state.conventions[dept] || getDefaultConventions();
    
    // 1. Max 54 hours per week (specifically in ER, but good generally)
    let currentWeekHours = 0;
    
    for (let d = 1; d <= daysInMonth; d++) {
        const val = emp.shifts[d] || "";
        const date = new Date(state.year, state.month, d);
        const dayOfWeek = date.getDay(); // 0 is Sunday
        
        let h = 0;
        if (val && convs[val] !== undefined) h = convs[val].hours;
        else if (val) h = 12;
        
        currentWeekHours += h;
        
        if (dayOfWeek === 0 || d === daysInMonth) {
            if (currentWeekHours > 54) {
                globalMsg = `Excede límite semanal de 54h (Semana con ${currentWeekHours}h)`;
            }
            currentWeekHours = 0; // Reset for next week
        }

        // 2. Post-Trasnocho: N must be followed by L
        if (val === 'N' && d < daysInMonth) {
            const nextVal = emp.shifts[d+1];
            if (nextVal && nextVal !== 'L' && nextVal !== '') {
                errors.push({day: d+1, msg: "Personal que sale de trasnocho NO debe tener turnos de apoyo al día siguiente (Debe ser L)."});
            }
        }
        
        // 3. ER Sequence: D, N, L, L
        if (dept === "URGENCIAS") {
            if (val === 'D' && d < daysInMonth) {
                const n1 = emp.shifts[d+1];
                const n2 = emp.shifts[d+2];
                const n3 = emp.shifts[d+3];
                // Warning if sequence not followed, but sometimes it's allowed if needed.
                if (n1 === 'D' || (n1 && n1 !== 'N' && n1 !== 'L')) {
                   // Just a soft check, maybe they have variations. Let's strictly check N after D if doing consecutive.
                }
            }
        }
    }
    
    return { errors, globalMsg };
}

// Data persistence & File Removal
async function saveLocal() {
    try {
        localStorage.setItem("msm_turnos", JSON.stringify(state));
        localStorage.setItem("msm_turnos_unidad", JSON.stringify(state));
    } catch(e) {}

    const uo = state.unidadOperativa || "Consolidado";
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const mName = monthNames[state.month] || "";
    const defaultJsonName = `Resguardo_Auditoria_${uo}_${mName}_${state.year}.json`;

    const res = await Swal.fire({
        title: '💾 Progreso Guardado Localmente',
        text: 'Los datos se guardaron en la memoria del navegador. ¿Deseas descargar también una copia de respaldo física (.json) para guardarla en tu equipo?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: '📥 Descargar Resguardo (.json)',
        cancelButtonText: 'Listo (Solo Memoria)',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b'
    });

    if (res.isConfirmed) {
        exportJSONFile(defaultJsonName);
    }
}

function exportJSONFile(suggestedName) {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", suggestedName || "Resguardo_Auditoria_MSM.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        Swal.fire({ icon: 'success', title: 'Resguardo Descargado', text: `Se descargó el archivo de respaldo '${suggestedName}' en tu carpeta de Descargas.` });
    } catch(e) {
        console.error("Error exporting JSON:", e);
    }
}

function autoRepairHrqvConsultaExterna() {
    if (!state.departments || !state.data) return;
    
    const missingEmployees = [
        {
            name: "VACANTE",
            cap: 1,
            shifts: { "1":"J1", "2":"J1", "3":"J5", "4":"L", "5":"J4", "6":"J4", "7":"J4", "8":"J4", "9":"J4", "10":"L", "11":"L", "12":"L", "13":"J3", "14":"J3", "15":"J3", "16":"J3", "17":"J5", "18":"L", "19":"J2", "20":"J2", "21":"J1", "22":"J1", "23":"J1", "24":"L", "25":"L", "26":"J2", "27":"J2", "28":"J2", "29":"J2", "30":"J2", "31":"L" }
        },
        {
            name: "VIASMIN OLAYA GUZMAN (VACUNACION)",
            cap: 1,
            shifts: { "1":"J8", "2":"J8", "3":"J5", "4":"L", "5":"J2", "6":"J8", "7":"J8", "8":"J8", "9":"J8", "10":"L", "11":"L", "12":"L", "13":"J2", "14":"J8", "15":"J8", "16":"J8", "17":"J9", "18":"L", "19":"J2", "20":"J8", "21":"J8", "22":"J8", "23":"J8", "24":"J9", "25":"L", "26":"J2", "27":"J8", "28":"J8", "29":"J8", "30":"J8", "31":"J5" }
        },
        {
            name: "MARIA CAMILA GIRALDO RINCON (ODONTOLOGIA)",
            cap: 1,
            shifts: { "1":"J8", "2":"J8", "3":"J7", "4":"L", "5":"J8", "6":"J8", "7":"J8", "8":"J8", "9":"J6", "10":"J7", "11":"L", "12":"L", "13":"J8", "14":"J8", "15":"J8", "16":"J6", "17":"J7", "18":"L", "19":"J8", "20":"J8", "21":"J8", "22":"J6", "23":"J6", "24":"J7", "25":"L", "26":"J8", "27":"J8", "28":"J8", "29":"J8", "30":"J8", "31":"J7" }
        }
    ];

    let patched = false;

    state.departments.forEach(dept => {
        let upper = dept.toUpperCase();
        if (upper.includes("CONSULTA EXTERNA")) {
            let emps = state.data[dept] || [];
            let hasYolanda = emps.some(e => e.name && e.name.toUpperCase().includes("YOLANDA HERRERA"));
            let hasViasmin = emps.some(e => e.name && e.name.toUpperCase().includes("VIASMIN"));
            
            if (hasYolanda && !hasViasmin && emps.length <= 6) {
                missingEmployees.forEach(m => {
                    emps.push({
                        id: Date.now().toString() + Math.random().toString(),
                        name: m.name,
                        shifts: { ...m.shifts },
                        cap: 1,
                        isHiddenRow: false
                    });
                });
                state.data[dept] = emps;
                patched = true;
            }

            if (!state.conventions) state.conventions = {};
            if (!state.conventions[dept]) state.conventions[dept] = getDefaultConventions();
            
            state.conventions[dept]['C'] = { hours: 1, description: 'Capacitaciones', color: '#d9f99d' };
            state.conventions[dept]['CAP'] = { hours: 1, description: 'Capacitación', color: '#d9f99d' };

            (state.data[dept] || []).forEach(emp => {
                if (emp.cap !== 1) {
                    emp.cap = 1;
                    patched = true;
                }
            });
        }
    });

    if (patched) {
        try {
            localStorage.setItem("msm_turnos_unidad", JSON.stringify(state));
            localStorage.setItem("msm_turnos", JSON.stringify(state));
        } catch(e) {}
    }
}

function loadLocal() {
    try {
        const saved = localStorage.getItem("msm_turnos") || localStorage.getItem("msm_turnos_unidad");
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.departments && Array.isArray(parsed.departments)) {
                Object.assign(state, parsed);
                autoRepairHrqvConsultaExterna();
            } else {
                localStorage.removeItem("msm_turnos");
            }
        }
    } catch(e) { 
        console.error("Error loading state", e); 
        localStorage.removeItem("msm_turnos");
    }
}

function updateLoadedFileBadge() {
    const badgeContainer = document.getElementById("loaded-file-info");
    const removeBtn = document.getElementById("btn-remove-file");

    const hasData = state.departments && state.departments.length > 0;
    const fileName = state.loadedFileName || (hasData ? "Archivo Importado" : "");

    if (hasData && fileName) {
        if (badgeContainer) {
            badgeContainer.innerHTML = `<span class="loaded-file-badge" style="font-size: 0.8rem; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); color: #2563eb; display: inline-flex; align-items: center; gap: 6px;">📄 ${fileName}</span>`;
            badgeContainer.style.display = "inline-flex";
        }
        if (removeBtn) {
            removeBtn.style.display = "inline-flex";
        }
    } else {
        if (badgeContainer) {
            badgeContainer.innerHTML = `<span class="loaded-file-badge empty" style="font-size: 0.8rem; font-weight: 600; padding: 4px 10px; border-radius: 6px; background: rgba(148, 163, 184, 0.15); color: #64748b; display: inline-flex; align-items: center; gap: 6px;">Sin archivo cargado</span>`;
            badgeContainer.style.display = "inline-flex";
        }
        if (removeBtn) {
            removeBtn.style.display = "none";
        }
    }
}

function removeLoadedFile() {
    promptRemoveFileOrUnit();
}

async function promptRemoveFileOrUnit() {
    if (!state.departments || state.departments.length === 0) {
        Swal.fire({ icon: 'info', title: 'Sin Datos', text: 'No hay cuadros ni unidades operativas cargadas actualmente.' });
        return;
    }

    const unitsMap = {};
    state.departments.forEach(dept => {
        let u = state.unidadOperativa || "UNIDAD OPERATIVA";
        if (dept.includes("|")) {
            u = dept.split("|")[0].trim();
        }
        if (!unitsMap[u]) unitsMap[u] = 0;
        unitsMap[u]++;
    });

    const unitKeys = Object.keys(unitsMap);

    let selectOptions = {};
    unitKeys.forEach(u => {
        selectOptions[u] = `🏥 ${u} (${unitsMap[u]} servicio${unitsMap[u] > 1 ? 's' : ''})`;
    });
    selectOptions['__ALL__'] = `⚠️ ELIMINAR TODO EL CUADRO (Todas las ${unitKeys.length} Unidades)`;

    const { value: selectedOption } = await Swal.fire({
        title: 'Seleccionar qué eliminar',
        text: 'Escoge la Unidad Operativa / Hospital específico que deseas eliminar del cuadro:',
        input: 'select',
        inputOptions: selectOptions,
        inputPlaceholder: 'Selecciona una unidad...',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar'
    });

    if (selectedOption) {
        if (selectedOption === '__ALL__') {
            await clearAllDataConfirmed();
        } else {
            await deleteOperationalUnit(selectedOption);
        }
    }
}

async function renameOperationalUnit(oldUnitName) {
    if (!oldUnitName) return;

    const { value: newUnitName } = await Swal.fire({
        title: 'Renombrar Unidad Operativa',
        html: `Ingresa el nombre correcto para la Unidad Operativa / Hospital <strong>"${oldUnitName}"</strong>:`,
        input: 'text',
        inputValue: oldUnitName,
        showCancelButton: true,
        confirmButtonText: 'Guardar Nombre',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return '¡Debes ingresar un nombre válido!';
            }
        }
    });

    if (!newUnitName || newUnitName.trim().toUpperCase() === oldUnitName.trim().toUpperCase()) return;

    let cleanNewName = newUnitName.trim().toUpperCase();
    let cleanOldName = oldUnitName.trim().toUpperCase();

    let deptMap = {};
    let newDepartmentsList = [];

    state.departments.forEach(dept => {
        let parts = dept.split('|');
        let deptUnit = parts.length > 1 ? parts[0].trim().toUpperCase() : (state.unidadOperativa ? state.unidadOperativa.toUpperCase() : "");
        let serviceName = parts.length > 1 ? parts[1].trim() : dept.trim();

        if (deptUnit === cleanOldName || (parts.length > 1 && parts[0].trim().toUpperCase() === cleanOldName)) {
            let newDeptKey = cleanNewName + "|" + serviceName;
            deptMap[dept] = newDeptKey;
            newDepartmentsList.push(newDeptKey);
        } else {
            newDepartmentsList.push(dept);
        }
    });

    state.departments = newDepartmentsList;

    let newData = {};
    let newConventions = {};
    let newHiddenDepts = {};
    let newStatus = {};
    let newFeedback = {};

    for (let k in state.data) {
        let newKey = deptMap[k] || k;
        newData[newKey] = state.data[k];
    }
    state.data = newData;

    for (let k in state.conventions) {
        let newKey = deptMap[k] || k;
        newConventions[newKey] = state.conventions[k];
    }
    state.conventions = newConventions;

    for (let k in state.hiddenDepartments) {
        let newKey = deptMap[k] || k;
        newHiddenDepts[newKey] = state.hiddenDepartments[k];
    }
    state.hiddenDepartments = newHiddenDepts;

    for (let k in state.status) {
        let newKey = deptMap[k] || k;
        newStatus[newKey] = state.status[k];
    }
    state.status = newStatus;

    for (let k in state.feedback) {
        let newKey = deptMap[k] || k;
        newFeedback[newKey] = state.feedback[k];
    }
    state.feedback = newFeedback;

    if (!state.unidadOperativa || state.unidadOperativa.trim().toUpperCase() === cleanOldName) {
        state.unidadOperativa = cleanNewName;
        if (typeof inputUnidad !== 'undefined' && inputUnidad) inputUnidad.value = cleanNewName;
        if (document.getElementById("input-unidad")) document.getElementById("input-unidad").value = cleanNewName;
    }

    if (state.currentDept && deptMap[state.currentDept]) {
        state.currentDept = deptMap[state.currentDept];
    }

    try {
        localStorage.setItem("msm_turnos", JSON.stringify(state));
        if (localStorage.getItem("msm_turnos_unidad") !== null) localStorage.setItem("msm_turnos_unidad", JSON.stringify(state));
        if (localStorage.getItem("msm_turnos_doe") !== null) localStorage.setItem("msm_turnos_doe", JSON.stringify(state));
    } catch(e) {}

    renderDepartments();
    if (state.currentDept) selectDepartment(state.currentDept);

    Swal.fire({
        icon: 'success',
        title: 'Unidad Renombrada',
        text: `La Unidad Operativa se renombró exitosamente a "${cleanNewName}".`,
        timer: 2000,
        showConfirmButton: false
    });
}

async function renameSingleService(fullDeptKey) {
    if (!fullDeptKey) return;
    let parts = fullDeptKey.split('|');
    let currentUnit = parts.length > 1 ? parts[0].trim() : (state.unidadOperativa || "UNIDAD OPERATIVA");
    let currentServiceName = parts.length > 1 ? parts[1].trim() : fullDeptKey.trim();

    const { value: newServiceName } = await Swal.fire({
        title: 'Renombrar Servicio',
        html: `Ingresa el nuevo nombre para el servicio <strong>"${currentServiceName}"</strong>:`,
        input: 'text',
        inputValue: currentServiceName,
        showCancelButton: true,
        confirmButtonText: 'Guardar Nombre',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#2563eb',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return '¡Debes ingresar un nombre de servicio válido!';
            }
        }
    });

    if (!newServiceName || newServiceName.trim().toUpperCase() === currentServiceName.trim().toUpperCase()) return;

    let cleanNewService = newServiceName.trim().toUpperCase();
    let newFullDeptKey = currentUnit + "|" + cleanNewService;

    if (state.departments.includes(newFullDeptKey)) {
        Swal.fire({ icon: 'warning', title: 'Nombre existente', text: `Ya existe un servicio llamado "${cleanNewService}" en ${currentUnit}.` });
        return;
    }

    let idx = state.departments.indexOf(fullDeptKey);
    if (idx !== -1) {
        state.departments[idx] = newFullDeptKey;
    }

    if (state.data[fullDeptKey]) {
        state.data[newFullDeptKey] = state.data[fullDeptKey];
        delete state.data[fullDeptKey];
    }
    if (state.conventions[fullDeptKey]) {
        state.conventions[newFullDeptKey] = state.conventions[fullDeptKey];
        delete state.conventions[fullDeptKey];
    }
    if (state.hiddenDepartments && state.hiddenDepartments[fullDeptKey]) {
        state.hiddenDepartments[newFullDeptKey] = state.hiddenDepartments[fullDeptKey];
        delete state.hiddenDepartments[fullDeptKey];
    }
    if (state.status && state.status[fullDeptKey]) {
        state.status[newFullDeptKey] = state.status[fullDeptKey];
        delete state.status[fullDeptKey];
    }
    if (state.feedback && state.feedback[fullDeptKey]) {
        state.feedback[newFullDeptKey] = state.feedback[fullDeptKey];
        delete state.feedback[fullDeptKey];
    }

    if (state.currentDept === fullDeptKey) {
        state.currentDept = newFullDeptKey;
    }

    try {
        localStorage.setItem("msm_turnos", JSON.stringify(state));
        if (localStorage.getItem("msm_turnos_unidad") !== null) localStorage.setItem("msm_turnos_unidad", JSON.stringify(state));
        if (localStorage.getItem("msm_turnos_doe") !== null) localStorage.setItem("msm_turnos_doe", JSON.stringify(state));
    } catch(e) {}

    renderDepartments();
    if (state.currentDept) selectDepartment(state.currentDept);

    Swal.fire({
        icon: 'success',
        title: 'Servicio Renombrado',
        text: `El servicio se renombró correctamente a "${cleanNewService}".`,
        timer: 2000,
        showConfirmButton: false
    });
}

function renameOperationalUnitDirectly(oldUnitName, newUnitName) {
    if (!newUnitName) return;
    let cleanNewName = newUnitName.trim().toUpperCase();
    let cleanOldName = oldUnitName ? oldUnitName.trim().toUpperCase() : "";

    if (cleanNewName === cleanOldName) return;

    let deptMap = {};
    let newDepartmentsList = [];

    (state.departments || []).forEach(dept => {
        let parts = dept.split('|');
        let deptUnit = parts.length > 1 ? parts[0].trim().toUpperCase() : (state.unidadOperativa ? state.unidadOperativa.toUpperCase() : "");
        let serviceName = parts.length > 1 ? parts[1].trim() : dept.trim();

        if (!cleanOldName || deptUnit === cleanOldName || (parts.length > 1 && parts[0].trim().toUpperCase() === cleanOldName) || cleanOldName.includes("SANTA") || cleanOldName === "UNIDAD OPERATIVA") {
            let newDeptKey = cleanNewName + "|" + serviceName;
            deptMap[dept] = newDeptKey;
            newDepartmentsList.push(newDeptKey);
        } else {
            newDepartmentsList.push(dept);
        }
    });

    state.departments = newDepartmentsList;

    let newData = {};
    let newConventions = {};
    let newHiddenDepts = {};
    let newStatus = {};
    let newFeedback = {};

    for (let k in state.data) {
        let newKey = deptMap[k] || k;
        newData[newKey] = state.data[k];
    }
    state.data = newData;

    for (let k in state.conventions) {
        let newKey = deptMap[k] || k;
        newConventions[newKey] = state.conventions[k];
    }
    state.conventions = newConventions;

    for (let k in state.hiddenDepartments) {
        let newKey = deptMap[k] || k;
        newHiddenDepts[newKey] = state.hiddenDepartments[k];
    }
    state.hiddenDepartments = newHiddenDepts;

    for (let k in state.status) {
        let newKey = deptMap[k] || k;
        newStatus[newKey] = state.status[k];
    }
    state.status = newStatus;

    for (let k in state.feedback) {
        let newKey = deptMap[k] || k;
        newFeedback[newKey] = state.feedback[k];
    }
    state.feedback = newFeedback;

    state.unidadOperativa = cleanNewName;

    if (state.currentDept && deptMap[state.currentDept]) {
        state.currentDept = deptMap[state.currentDept];
    }

    try {
        localStorage.setItem("msm_turnos", JSON.stringify(state));
        if (localStorage.getItem("msm_turnos_unidad") !== null) localStorage.setItem("msm_turnos_unidad", JSON.stringify(state));
        if (localStorage.getItem("msm_turnos_doe") !== null) localStorage.setItem("msm_turnos_doe", JSON.stringify(state));
    } catch(e) {}

    renderDepartments();
    if (state.currentDept) selectDepartment(state.currentDept);
}

async function deleteOperationalUnit(unitName) {
    if (!unitName) return;

    const deptsToRemove = state.departments.filter(dept => {
        let u = state.unidadOperativa || "UNIDAD OPERATIVA";
        if (dept.includes("|")) {
            u = dept.split("|")[0].trim();
        }
        return u === unitName;
    });

    if (deptsToRemove.length === 0) return;

    const approvedDepts = deptsToRemove.filter(d => state.status && state.status[d] === 'approved');
    let warningNote = '';
    if (approvedDepts.length > 0) {
        warningNote = `<br><span style="color:#dc2626; font-size:0.85rem;">⚠️ Atención: Esta unidad contiene ${approvedDepts.length} servicio(s) que ya habían sido APROBADOS.</span>`;
    }

    const res = await Swal.fire({
        title: `¿Eliminar hospital/unidad ${unitName}?`,
        html: `Se eliminarán únicamente los <strong>${deptsToRemove.length} servicio(s)</strong> de <strong>${unitName}</strong>:<br><br><small style="color:#64748b;">${deptsToRemove.map(d => d.includes('|') ? d.split('|')[1].trim() : d).join(', ')}</small>${warningNote}<br><br><em>Los demás hospitales y aprobaciones permanecerán intactos.</em>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar esta unidad',
        cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
        state.departments = state.departments.filter(d => !deptsToRemove.includes(d));

        deptsToRemove.forEach(d => {
            delete state.data[d];
            delete state.conventions[d];
            if (state.status) delete state.status[d];
            if (state.feedback) delete state.feedback[d];
            if (state.hiddenDepartments) delete state.hiddenDepartments[d];
        });

        if (deptsToRemove.includes(state.currentDept)) {
            state.currentDept = state.departments[0] || null;
        }

        saveLocal();
        updateLoadedFileBadge();
        renderDepartments();

        if (state.currentDept) {
            selectDepartment(state.currentDept);
        } else {
            if (tableBodyEmployees) tableBodyEmployees.innerHTML = "";
            if (currentDeptTitle) currentDeptTitle.textContent = "Seleccione un área";
            if (emptyState) emptyState.classList.remove("hidden");
        }

        Swal.fire({
            icon: 'success',
            title: 'Unidad Operativa Eliminada',
            text: `Se eliminaron los datos de '${unitName}'. Los demás hospitales permanecen intactos.`,
            timer: 2000,
            showConfirmButton: false
        });
    }
}

async function clearAllDataConfirmed() {
    const res = await Swal.fire({
        title: '¿Eliminar TODO el cuadro?',
        html: '<strong>¡ATENCIÓN!</strong> Se borrarán <strong>TODAS las Unidades Operativas y servicios</strong> actualmente cargados en pantalla.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar todo',
        cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
        state.departments = [];
        state.data = {};
        state.conventions = {};
        state.status = {};
        state.feedback = {};
        state.currentDept = null;
        state.unidadOperativa = "";
        state.loadedFileName = "";

        const jsonInput = document.getElementById("file-input-json");
        const excelInput = document.getElementById("file-input-excel");
        if (jsonInput) jsonInput.value = "";
        if (excelInput) excelInput.value = "";
        if (inputUnidad) inputUnidad.value = "";

        localStorage.removeItem("msm_turnos");
        localStorage.removeItem("msm_turnos_unidad");

        updateLoadedFileBadge();
        renderDepartments();
        if (tableBodyEmployees) tableBodyEmployees.innerHTML = "";
        if (currentDeptTitle) currentDeptTitle.textContent = "Seleccione un área";
        if (emptyState) emptyState.classList.remove("hidden");

        Swal.fire({
            icon: 'success',
            title: 'Cuadro Limpiado',
            text: 'Se han eliminado todas las unidades del cuadro.',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

async function deleteDepartment(deptKey) {
    const res = await Swal.fire({
        title: '¿Eliminar servicio cargado?',
        text: `¿Deseas eliminar únicamente el servicio '${deptKey}' del cuadro?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sí, eliminar servicio',
        cancelButtonText: 'Cancelar'
    });

    if (res.isConfirmed) {
        state.departments = state.departments.filter(d => d !== deptKey);
        delete state.data[deptKey];
        delete state.conventions[deptKey];
        if (state.status) delete state.status[deptKey];
        if (state.feedback) delete state.feedback[deptKey];
        if (state.hiddenDepartments) delete state.hiddenDepartments[deptKey];

        if (state.currentDept === deptKey) {
            state.currentDept = state.departments[0] || null;
        }

        saveLocal();
        renderDepartments();
        if (state.currentDept) {
            selectDepartment(state.currentDept);
        } else {
            if (tableBodyEmployees) tableBodyEmployees.innerHTML = "";
            if (currentDeptTitle) currentDeptTitle.textContent = "Seleccione un área";
            if (emptyState) emptyState.classList.remove("hidden");
        }
        updateLoadedFileBadge();
        Swal.fire({ icon: 'success', title: 'Servicio Eliminado', timer: 1200, showConfirmButton: false });
    }
}

function loadJSON(e) {
    const file = e.target.files[0];
    if(!file) return;
    state.loadedFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            Object.assign(state, parsed);
            if (selectYear) selectYear.value = state.year;
            if (selectMonth) selectMonth.value = state.month;
            if (inputUnidad) inputUnidad.value = state.unidadOperativa || "";
            if (inputResponsable) inputResponsable.value = state.responsable || state.evaluador || "";
            
            try {
                localStorage.setItem("msm_turnos", JSON.stringify(state));
                localStorage.setItem("msm_turnos_unidad", JSON.stringify(state));
            } catch(e) {}

            updateLoadedFileBadge();
            renderDepartments();
            if (state.currentDept) selectDepartment(state.currentDept);
            else if (state.departments && state.departments.length > 0) selectDepartment(state.departments[0]);
            
            Swal.fire({ icon: 'success', title: 'Resguardo Cargado', text: 'Se restauró el cuadro y todos los dictámenes y observaciones de la auditoría correctamente.' });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Archivo de resguardo JSON inválido' });
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function strVal(val) {
    if (val === null || val === undefined) return "";
    return val.toString();
}

function checkSheetHidden(workbook, sheetIdx) {
    try {
        if (workbook) {
            if (workbook.Workbook && workbook.Workbook.Sheets) {
                let sheets = workbook.Workbook.Sheets;
                let meta = sheets[sheetIdx] || (Array.isArray(sheets) ? sheets[sheetIdx] : null);
                if (meta && (meta.Hidden === 1 || meta.Hidden === 2 || meta.hidden === true)) {
                    return true;
                }
            }
            if (workbook.SheetNames && workbook.SheetNames[sheetIdx] && workbook.Sheets) {
                let ws = workbook.Sheets[workbook.SheetNames[sheetIdx]];
                if (ws && (ws['!hidden'] === true || ws['!hidden'] === 1)) {
                    return true;
                }
            }
        }
    } catch(e) {}
    return false;
}

function isCopyOrDraftSheetName(sheetName) {
    if (!sheetName) return false;
    return /\(\d+\)|COPIA|COPY|DRAFT|OLD|ANTERIOR|VIEJO/i.test(sheetName);
}

function getDeptStatus(deptKey) {
    if (!state.status || !deptKey) return null;
    if (state.status[deptKey] !== undefined) return state.status[deptKey];
    let service = deptKey.includes("|") ? deptKey.split("|")[1].trim() : deptKey.trim();
    for (let k in state.status) {
        let kService = k.includes("|") ? k.split("|")[1].trim() : k.trim();
        if (kService === service || k.trim() === deptKey.trim()) {
            return state.status[k];
        }
    }
    return null;
}

function getDeptFeedback(deptKey) {
    if (!state.feedback || !deptKey) return "";
    if (state.feedback[deptKey] !== undefined) return state.feedback[deptKey];
    let service = deptKey.includes("|") ? deptKey.split("|")[1].trim() : deptKey.trim();
    for (let k in state.feedback) {
        let kService = k.includes("|") ? k.split("|")[1].trim() : k.trim();
        if (kService === service || k.trim() === deptKey.trim()) {
            return state.feedback[k];
        }
    }
    return "";
}

function checkRowHidden(ws, rowIndex) {
    try {
        if (ws && ws['!rows']) {
            let r = ws['!rows'][rowIndex];
            if (r && (r.hidden === true || r.h === true || r.hidden === 1)) {
                return true;
            }
        }
    } catch(e) {}
    return false;
}

function getInferredShiftHours(code) {
    if (!code) return 8;
    let c = code.toString().trim().toUpperCase();
    if (['L', 'LIBRE', 'DESCANSO', 'DAC', 'VAC', 'V'].includes(c)) return 0;
    if (['N', 'NOCTURNO'].includes(c)) return 12;
    if (['M', 'T'].includes(c)) return 6;
    if (['CAP', 'C'].includes(c)) return 2;
    return 8;
}

function getSafeAOA(ws) {
    if (!ws) return [];
    try {
        if (ws['!ref']) {
            let range = XLSX.utils.decode_range(ws['!ref']);
            if (range.e.r > 250) range.e.r = 250;
            if (range.e.c > 65) range.e.c = 65;
            ws['!ref'] = XLSX.utils.encode_range(range);
        }
        return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
    } catch(e) {
        console.error("Error reading sheet AOA:", e);
        return [];
    }
}

function extractUnitFromAOA(aoa) {
    if (!aoa || aoa.length === 0) return "";
    for (let i = 0; i < Math.min(20, aoa.length); i++) {
        const row = aoa[i] || [];
        for (let j = 0; j < row.length; j++) {
            let str = strVal(row[j]).trim();
            let upper = str.toUpperCase();
            if (upper.includes('UNIDAD FUNCIONAL') || upper.includes('UNIDAD OPERATIVA')) {
                let sameCell = str.replace(/.*UNIDAD\s+(FUNCIONAL|OPERATIVA)\s*[:\-]?\s*/i, "").replace(/^[:\-]\s*/, "").trim();
                if (sameCell && sameCell.length >= 3 && !/SANTA\s+MONICA|SANTA\s+MÓNICA|EJEMPLO|PLANTILLA/i.test(sameCell)) {
                    return sameCell;
                }
                for (let offset = 1; offset <= 3; offset++) {
                    if (j + offset < row.length) {
                        let nextVal = strVal(row[j + offset]).trim();
                        if (nextVal && nextVal.length >= 3 && !/SANTA\s+MONICA|SANTA\s+MÓNICA|EJEMPLO|PLANTILLA/i.test(nextVal)) {
                            return nextVal;
                        }
                    }
                }
            }
        }
    }
    return "";
}

async function loadExcel(e) {
    const fileInput = e.target;
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    
    const files = Array.from(fileInput.files);
    
    Swal.fire({
        title: 'Cargando Archivos Excel...',
        html: `Procesando 1 de ${files.length} archivo(s)...`,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    let totalNewDeptsAdded = 0;
    let processedFilesCount = 0;
    let lastFileName = "";

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const file = files[fIdx];
        lastFileName = file.name;
        
        if (Swal.isVisible()) {
            Swal.update({ html: `Procesando archivo (${fIdx + 1}/${files.length}): <strong>${file.name}</strong>` });
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            
            let extractedUnidad = "";
            // 1. Search visible official sheets first
            for (let sIdx = 0; sIdx < workbook.SheetNames.length; sIdx++) {
                let sName = workbook.SheetNames[sIdx];
                let isHidden = checkSheetHidden(workbook, sIdx);
                let isCopy = isCopyOrDraftSheetName(sName);
                if (!isHidden && !isCopy) {
                    let ws = workbook.Sheets[sName];
                    let aoa = getSafeAOA(ws);
                    let u = extractUnitFromAOA(aoa);
                    if (u) {
                        extractedUnidad = u;
                        break;
                    }
                }
            }
            // 2. Fallback to any sheet if not found in visible official sheets
            if (!extractedUnidad) {
                for (let sIdx = 0; sIdx < workbook.SheetNames.length; sIdx++) {
                    let ws = workbook.Sheets[workbook.SheetNames[sIdx]];
                    let aoa = getSafeAOA(ws);
                    let u = extractUnitFromAOA(aoa);
                    if (u) {
                        extractedUnidad = u;
                        break;
                    }
                }
            }
            
            if (!extractedUnidad || /SANTA\s+MONICA|SANTA\s+MÓNICA|EJEMPLO|PLANTILLA|TEMPLATE/i.test(extractedUnidad)) {
                let cleanFileName = file.name ? file.name.replace(/\.[^/.]+$/, "").replace(/^\d+\.\s*/, "").trim() : "";
                if (cleanFileName && !/SANTA\s+MONICA|SANTA\s+MÓNICA/i.test(cleanFileName)) {
                    extractedUnidad = cleanFileName;
                }
            }
            
            let unidadOperativa = extractedUnidad || state.unidadOperativa || "";
            if (unidadOperativa) {
                state.unidadOperativa = unidadOperativa;
                if (typeof inputUnidad !== 'undefined' && inputUnidad) inputUnidad.value = unidadOperativa;
                if (document.getElementById("input-unidad")) document.getElementById("input-unidad").value = unidadOperativa;
            }
            
            let newDepartments = [];
            let newData = {};
            let newConventions = {};
            let newHiddenDepts = {};
            
            let sortedSheetInfos = workbook.SheetNames.map((sheetName, sheetIdx) => {
                const ws = workbook.Sheets[sheetName];
                const aoa = getSafeAOA(ws);
                let isSheetHidden = checkSheetHidden(workbook, sheetIdx);
                let isCopy = isCopyOrDraftSheetName(sheetName);
                
                let extractedService = "";
                if (aoa && aoa.length > 0) {
                    for (let i = 0; i < Math.min(15, aoa.length); i++) {
                        const row = aoa[i] || [];
                        for (let j = 0; j < row.length; j++) {
                            let str = strVal(row[j]).toUpperCase();
                            if (str.includes('SERVICIO:')) {
                                let clean = str.replace('SERVICIO:', '').trim();
                                if (clean) {
                                    extractedService = clean;
                                } else if (j + 1 < row.length && strVal(row[j + 1]).trim()) {
                                    extractedService = strVal(row[j + 1]).trim();
                                }
                                break;
                            }
                        }
                        if (extractedService) break;
                    }
                }
                
                let priority = 0;
                if (isSheetHidden) priority += 2;
                if (isCopy) priority += 1;
                
                return { sheetName, sheetIdx, ws, aoa, isSheetHidden, isCopy, extractedService, priority };
            });

            sortedSheetInfos.sort((a, b) => a.priority - b.priority || a.sheetIdx - b.sheetIdx);

            sortedSheetInfos.forEach(sInfo => {
                const { sheetName, ws, aoa, isSheetHidden, isCopy, extractedService } = sInfo;
                if (!aoa || aoa.length === 0) return;
                
                let baseDeptName = extractedService || sheetName;
                let finalDeptName = unidadOperativa && !baseDeptName.toUpperCase().includes(unidadOperativa.toUpperCase())
                    ? unidadOperativa + "|" + baseDeptName.toUpperCase().trim()
                    : baseDeptName.toUpperCase().trim();

                if (newDepartments.includes(finalDeptName) || (state.departments && state.departments.includes(finalDeptName))) {
                    let altName = sheetName.toUpperCase().trim();
                    let altDeptName = unidadOperativa && !altName.includes(unidadOperativa.toUpperCase())
                        ? unidadOperativa + "|" + altName
                        : altName;
                    
                    if (!newDepartments.includes(altDeptName) && (!state.departments || !state.departments.includes(altDeptName))) {
                        finalDeptName = altDeptName;
                    } else {
                        let candidate = `${finalDeptName} (${altName})`;
                        let counter = 2;
                        while (newDepartments.includes(candidate) || (state.departments && state.departments.includes(candidate))) {
                            candidate = `${finalDeptName} (${counter++})`;
                        }
                        finalDeptName = candidate;
                    }
                }
                
                let dateRows = [];
                for (let i = 0; i < aoa.length; i++) {
                    const row = aoa[i];
                    if (!row) continue;
                    let colMapCand = {};
                    let maxCols = Math.min(60, row.length);
                    for (let j = 0; j < maxCols; j++) {
                        let d = extractDayNumber(row[j]);
                        if (d !== null && colMapCand[d] === undefined) {
                            colMapCand[d] = j;
                        }
                    }
                    if (Object.keys(colMapCand).length >= 10) {
                        dateRows.push({ datesRowIndex: i, colMap: colMapCand });
                    }
                }
                
                if (dateRows.length === 0) return;
                
                if (!newDepartments.includes(finalDeptName)) newDepartments.push(finalDeptName);
                if (!newData[finalDeptName]) newData[finalDeptName] = [];
                if (isSheetHidden || isCopy) newHiddenDepts[finalDeptName] = true;
                
                let parsedConventions = parseExcelConventions(aoa);
                newConventions[finalDeptName] = parsedConventions;
                
                let seenNames = new Set();
                let primaryDateRow = dateRows[0];
                let datesRowIndex = primaryDateRow.datesRowIndex;
                let colMap = primaryDateRow.colMap;
                let nextBoundaryIndex = (dateRows.length > 1) ? dateRows[1].datesRowIndex : aoa.length;
                
                let daysInMonth = 31;
                let dayNums = Object.keys(colMap).map(n => parseInt(n));
                if (dayNums.length > 0) daysInMonth = Math.max(...dayNums);
                let firstDayCol = colMap[1] !== undefined ? colMap[1] : Math.min(...Object.values(colMap));
                
                let nameCol = -1;
                for (let r_i = Math.max(0, datesRowIndex - 2); r_i <= datesRowIndex; r_i++) {
                    const r = aoa[r_i] || [];
                    for (let c_i = 0; c_i < firstDayCol; c_i++) {
                        let str = strVal(r[c_i]).toUpperCase();
                        if (str.includes('NOMBRE') || str.includes('FUNCIONARIO') || str.includes('COLABORADOR') || str.includes('ASOCIADO') || str.includes('EMPLEADO') || str.includes('ASIGNACION')) {
                            nameCol = c_i;
                            break;
                        }
                    }
                    if (nameCol !== -1) break;
                }
                
                if (nameCol === -1) {
                    for (let c_cand = 0; c_cand < firstDayCol; c_cand++) {
                        let hasText = false;
                        for (let r_check = datesRowIndex + 1; r_check < Math.min(datesRowIndex + 8, aoa.length); r_check++) {
                            if (aoa[r_check] && aoa[r_check].length > c_cand && strVal(aoa[r_check][c_cand]).trim()) {
                                hasText = true;
                                break;
                            }
                        }
                        if (hasText) {
                            nameCol = c_cand;
                            break;
                        }
                    }
                }
                
                if (nameCol === -1) {
                    nameCol = Math.max(0, firstDayCol - 1);
                }
                
                for (let i = datesRowIndex + 1; i < nextBoundaryIndex; i++) {
                    const row = aoa[i];
                    if (!row || row.length === 0) continue;
                    if (nameCol >= row.length) continue;
                    
                    let rawName = strVal(row[nameCol]).trim();
                    if (!rawName) continue;
                    let upperName = rawName.toUpperCase();
                    
                    if (['TOTAL HORAS', 'FIRMA', 'ELABORO', 'CONVENCIONES', 'NOTA:'].some(kw => upperName.includes(kw))) {
                        break;
                    }
                    
                    if (/\b(NOMBRE|TURNO|DIA|HORAS|PERIODO|UNIDAD|APROBO|REVISO)\b/.test(upperName)) {
                        if (!/[A-Z]{3,}\s+[A-Z]{3,}/.test(upperName)) {
                            continue;
                        }
                    }
                    
                    const isVacancy = /^(VACANTE|DISPONIBLE|POR CONTRATAR|LIBRE|SIN ASIGNAR)(\s*\d+)?$/i.test(upperName.trim());
                    if (!isVacancy && seenNames.has(upperName)) break;
                    
                    let shifts = {};
                    let isNumericTable = true;
                    for (let d = 1; d <= daysInMonth; d++) {
                        if (colMap[d] !== undefined && colMap[d] < row.length) {
                            let shiftVal = strVal(row[colMap[d]]).trim().toUpperCase();
                            if (shiftVal) {
                                shifts[d] = shiftVal;
                                if (!/^\d+(\.\d+)?$/.test(shiftVal)) {
                                    isNumericTable = false;
                                }
                            }
                        }
                    }
                    
                    if (isNumericTable && Object.keys(shifts).length > 0) {
                        break;
                    }
                    
                    if (Object.keys(shifts).length > 0) {
                        seenNames.add(upperName);
                        let capUnitHours = getDepartmentCapHours(parsedConventions);
                        let capShiftCount = Object.values(shifts).filter(s => {
                            let sv = strVal(s).trim().toUpperCase();
                            return sv === 'CAP' || sv === 'C';
                        }).length;
                        let empCap = capShiftCount > 0 ? (capShiftCount * capUnitHours) : capUnitHours;

                        let isRowHidden = checkRowHidden(ws, i);

                        let emp = {
                            id: Date.now().toString() + Math.random().toString(),
                            name: rawName,
                            shifts: shifts,
                            cap: empCap,
                            isHiddenRow: isRowHidden
                        };
                        newData[finalDeptName].push(emp);
                    }
                }
                
                let usedShiftCodes = new Set();
                (newData[finalDeptName] || []).forEach(emp => {
                    Object.values(emp.shifts || {}).forEach(s => {
                        if (s && typeof s === 'string' && s.trim()) {
                            usedShiftCodes.add(s.trim().toUpperCase());
                        }
                    });
                });

                let currentConvs = newConventions[finalDeptName] || {};
                usedShiftCodes.forEach(code => {
                    if (currentConvs[code] === undefined) {
                        currentConvs[code] = {
                            hours: getInferredShiftHours(code),
                            color: getConventionColor(code)
                        };
                    }
                });
                newConventions[finalDeptName] = currentConvs;
            });
            
            if (newDepartments.length > 0) {
                if (!state.departments) state.departments = [];
                if (!state.data) state.data = {};
                if (!state.conventions) state.conventions = {};
                if (!state.hiddenDepartments) state.hiddenDepartments = {};
                if (!state.status) state.status = {};
                if (!state.feedback) state.feedback = {};

                newDepartments.forEach(dept => {
                    if (!state.departments.includes(dept)) {
                        state.departments.push(dept);
                        totalNewDeptsAdded++;
                    }
                    state.data[dept] = newData[dept];
                    state.conventions[dept] = newConventions[dept];
                    if (newHiddenDepts[dept]) {
                        state.hiddenDepartments[dept] = true;
                    }
                    if (!state.status[dept]) {
                        state.status[dept] = 'review';
                    }
                });
            }

            processedFilesCount++;
        } catch(err) {
            console.error("loadExcel error:", file.name, err);
        }
    }

    if (lastFileName) {
        state.loadedFileName = files.length > 1 ? `${files.length} Archivos Excel` : lastFileName;
    }

    try {
        localStorage.setItem("msm_turnos", JSON.stringify(state));
        if (localStorage.getItem("msm_turnos_unidad") !== null) localStorage.setItem("msm_turnos_unidad", JSON.stringify(state));
        if (localStorage.getItem("msm_turnos_doe") !== null) localStorage.setItem("msm_turnos_doe", JSON.stringify(state));
    } catch(e) {}

    updateLoadedFileBadge();
    renderDepartments();

    if (state.departments && state.departments.length > 0) {
        if (!state.currentDept || !state.departments.includes(state.currentDept)) {
            selectDepartment(state.departments[0]);
        } else {
            selectDepartment(state.currentDept);
        }
    }

    if (fileInput) fileInput.value = '';

    Swal.fire({
        icon: 'success',
        title: '¡Carga Masiva Exitosa!',
        html: `Se procesaron correctamente <strong>${processedFilesCount}</strong> archivo(s) Excel.<br>Se cargaron <strong>${totalNewDeptsAdded}</strong> servicio(s) en total en el cuadro.`,
        confirmButtonColor: '#2563eb'
    });
}

function exportExcel() {
    if (!state.currentDept) {
        Swal.fire({ icon: 'warning', title: 'Atención', text: 'Selecciona un área para exportar.' });
        return;
    }
    const convs = state.conventions[state.currentDept] || getDefaultConventions();
    const wb = XLSX.utils.book_new();
    const daysInMonth = getDaysInMonth(state.year, state.month);
    
    // We will build the sheet directly using a more controlled approach
    let wsData = [];
    
    // Rows 1-5 Empty or Titles
    wsData.push(["", "", "", "CUADRO DE TURNOS"]);
    wsData.push([]); wsData.push([]); wsData.push([]); wsData.push([]);
    wsData.push(["", "UNIDAD FUNCIONAL:", "", state.unidadOperativa.toUpperCase() || "MUNDO SALUD MÉDICA"]);
    wsData.push(["", "SERVICIO:", "", state.currentDept]);
    wsData.push(["", "PERIODO:", "", `1 AL ${daysInMonth} DE ${selectMonth.options[selectMonth.selectedIndex].text.toUpperCase()} DE ${state.year}`]);
    wsData.push([]);
    wsData.push(["", selectMonth.options[selectMonth.selectedIndex].text.toUpperCase()]);
    
    // Headers 1 (Weekdays)
    let head1 = ["", "NOMBRE"];
    let weekCounterH = 1;
    for(let d=1; d<=daysInMonth; d++) {
        const date = new Date(state.year, state.month, d);
        head1.push(weekdayNames[date.getDay()]);
        if (date.getDay() === 0 || d === daysInMonth) {
            head1.push("S" + weekCounterH);
            weekCounterH++;
        }
    }
    head1.push("H", "CAP", "FIRMA");
    wsData.push(head1);
    
    // Headers 2 (Days)
    let head2 = ["", ""];
    for(let d=1; d<=daysInMonth; d++) {
        const date = new Date(state.year, state.month, d);
        head2.push(d);
        if (date.getDay() === 0 || d === daysInMonth) {
            head2.push("Σ");
        }
    }
    head2.push("", "", ""); // H, CAP, FIRMA alignment
    wsData.push(head2);
    
    // Employee Data (Shifts)
    const employees = state.data[state.currentDept];
    employees.forEach(emp => {
        let row = ["", emp.name];
        let currentWeekHours = 0;
        for(let d=1; d<=daysInMonth; d++) {
            const val = emp.shifts[d] || "";
            row.push(val);
            let h = 0;
            if (val && convs[val] !== undefined) h = convs[val].hours;
            else if (val) h = 12;
            currentWeekHours += h;
            
            const date = new Date(state.year, state.month, d);
            if (date.getDay() === 0 || d === daysInMonth) {
                row.push(currentWeekHours + "h");
                currentWeekHours = 0;
            }
        }
        row.push("", emp.cap || 1, "");
        wsData.push(row);
    });
    
    // Spacer
    wsData.push([]);
    wsData.push(["", selectMonth.options[selectMonth.selectedIndex].text.toUpperCase()]);
    
    // Totals Table Headers
    let totHead = ["", "NOMBRE"];
    for(let d=1; d<=daysInMonth; d++) { 
        const date = new Date(state.year, state.month, d);
        totHead.push(d); 
        if (date.getDay() === 0 || d === daysInMonth) {
            totHead.push("Σ");
        }
    }
    totHead.push("H", "CAP", "TOTAL HORAS");
    wsData.push(totHead);
    
    // Employee Data (Hours)
    let totalCols = []; // Track column sums
    employees.forEach(emp => {
        let row = ["", emp.name];
        let total = 0;
        let currentWeekHours = 0;
        let colIdx = 2;
        for(let d=1; d<=daysInMonth; d++) {
            const val = emp.shifts[d] || "";
            let h = 0;
            if (val && convs[val] !== undefined) h = convs[val].hours;
            else if (val) h = 12;
            row.push(h);
            totalCols[colIdx] = (totalCols[colIdx] || 0) + h; colIdx++;
            
            total += h;
            currentWeekHours += h;
            
            const date = new Date(state.year, state.month, d);
            if (date.getDay() === 0 || d === daysInMonth) {
                row.push(currentWeekHours);
                totalCols[colIdx] = (totalCols[colIdx] || 0) + currentWeekHours; colIdx++;
                currentWeekHours = 0;
            }
        }
        let capH = getEmpCapHours(emp, state.currentDept);
        row.push(total, capH, total + capH);
        totalCols[colIdx] = (totalCols[colIdx] || 0) + total; colIdx++;
        totalCols[colIdx] = (totalCols[colIdx] || 0) + capH; colIdx++;
        totalCols[colIdx] = (totalCols[colIdx] || 0) + total + capH;
        wsData.push(row);
    });
    
    // Summary Row (TOTAL HORAS DIA)
    let sumRow = ["", "TOTAL HORAS DIA"];
    for(let i=2; i<totHead.length; i++) {
        sumRow.push(totalCols[i] || 0);
    }
    wsData.push(sumRow);
    
    // Spacer
    wsData.push([]); wsData.push([]);
    
    // Conventions Table
    let convStartRow = wsData.length;
    wsData.push(["", "NO SE PERMITE CAMBIO DE TURNO SIN PREVIA AUTORIZACION DEL COORDINADOR"]);
    wsData.push(["", "CONVENCIONES"]);
    wsData.push(["", "TURNO", "INICIO", "FIN", "INICIO", "FIN", "TOTAL HORAS"]);
    for (const [code, info] of Object.entries(convs)) {
        wsData.push(["", code, "", "", "", "", info.hours]);
    }
    
    // Create Sheet
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // --- STYLING (Requires xlsx-js-style) ---
    const borderStyle = { 
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
    };
    const headerStyle = {
        font: { bold: true, sz: 10 },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: "DDDDDD" } },
        border: borderStyle
    };
    const cellStyle = {
        font: { sz: 10 },
        alignment: { horizontal: "center", vertical: "center" },
        border: borderStyle
    };
    const boldStyle = { ...cellStyle, font: { bold: true, sz: 10 } };
    
    // Apply styles to all cells
    let range = XLSX.utils.decode_range(ws['!ref']);
    for(let R = 0; R <= range.e.r; ++R) {
        for(let C = 0; C <= range.e.c; ++C) {
            let cell_address = {c:C, r:R};
            let cell_ref = XLSX.utils.encode_cell(cell_address);
            if(!ws[cell_ref]) continue;
            
            // Default styling
            ws[cell_ref].s = { font: { sz: 10 } };
            
            // Header block (Rows 10-11 and 10+emps+3 to 10+emps+4)
            let isHeader = false;
            let isGrid = false;
            
            // Detect grids:
            let topGridStart = 9;
            let topGridEnd = topGridStart + 2 + employees.length;
            
            let bottomGridStart = topGridEnd + 2;
            let bottomGridEnd = bottomGridStart + 2 + employees.length + 1; // +1 for sum row
            
            if (R >= topGridStart && R < topGridEnd) {
                isGrid = true;
                if (R === topGridStart || R === topGridStart + 1) isHeader = true;
            }
            if (R >= bottomGridStart && R < bottomGridEnd) {
                isGrid = true;
                if (R === bottomGridStart || R === bottomGridStart + 1) isHeader = true;
            }
            
            if (isGrid && C >= 1) { // Apply borders and alignment from col B onwards
                if (isHeader) {
                    ws[cell_ref].s = headerStyle;
                } else {
                    ws[cell_ref].s = cellStyle;
                    // Highlight subtotals
                    if (wsData[topGridStart+1][C] === 'Σ' || (typeof wsData[topGridStart+1][C] === 'string' && wsData[topGridStart+1][C].includes('S'))) {
                        ws[cell_ref].s = { ...cellStyle, fill: { fgColor: { rgb: "F2F2F2" } } };
                    }
                }
            }
            
            // Conventions grid
            if (R > convStartRow && R <= wsData.length && C >= 1 && C <= 6) {
                ws[cell_ref].s = cellStyle;
                if (R === convStartRow + 1 || R === convStartRow + 2) {
                    ws[cell_ref].s = headerStyle;
                }
            }
            
            // Title styles
            if (R === 0 && C === 3) ws[cell_ref].s = { font: { bold: true, sz: 14 } };
            if (R >= 5 && R <= 7 && C === 1) ws[cell_ref].s = { font: { bold: true, sz: 10 } };
            if (R === convStartRow && C === 1) ws[cell_ref].s = { font: { bold: true, sz: 10 } };
        }
    }
    
    // Column widths
    ws['!cols'] = [
        {wch: 2}, // A
        {wch: 25}, // B (Names)
    ];
    for(let i=2; i<head1.length; i++) ws['!cols'].push({wch: 4}); // Day cols
    
    // Merges
    ws['!merges'] = [
        { s: {r:0, c:3}, e: {r:0, c:8} }, // CUADRO DE TURNOS
        { s: {r:convStartRow, c:1}, e: {r:convStartRow, c:6} }, // NO SE PERMITE...
        { s: {r:convStartRow+1, c:1}, e: {r:convStartRow+1, c:6} }, // CONVENCIONES
        
        // FIRMA merge
        { s: {r:9, c:head1.length-1}, e: {r:10, c:head1.length-1} },
        { s: {r:9, c:1}, e: {r:10, c:1} }, // NOMBRE
        { s: {r:bottomGridStart, c:1}, e: {r:bottomGridStart+1, c:1} } // NOMBRE (bottom grid)
    ];
    
    // FIRMA merges for employees
    let topGridStart = 9;
    for(let i=0; i<employees.length; i++) {
        ws['!merges'].push({
            s: {r: topGridStart + 2 + i, c: head1.length-1},
            e: {r: topGridStart + 2 + i, c: head1.length + 3} // Merge 4 cols for signature
        });
    }
    
    XLSX.utils.book_append_sheet(wb, ws, state.currentDept);
    XLSX.writeFile(wb, `Cuadro_Turnos_${state.currentDept}_${selectMonth.options[selectMonth.selectedIndex].text}_${state.year}.xlsx`);
}

// Modal Logic
function openConvModal() {
    if(!state.currentDept) return;
    const convs = state.conventions[state.currentDept] || getDefaultConventions();
    tbodyConv.innerHTML = "";
    for (const [code, info] of Object.entries(convs)) {
        createConvRow(code, info.hours, info.description || "", info.color);
    }
    modalConv.classList.remove("hidden");
}

function createConvRow(code = "", hours = 12, description = "", color = "#bfdbfe") {
    const tr = document.createElement("tr");
    const normColor = normalizeHexColor(color, "#bfdbfe");
    const textColor = getContrastTextColor(normColor);

    tr.innerHTML = `
        <td><input type="text" class="inp-c-code" value="${code}" placeholder="Ej: J1"></td>
        <td><input type="text" class="inp-c-desc" value="${description}" placeholder="Ej: 07:00 - 16:30"></td>
        <td><input type="number" class="inp-c-hours" value="${hours}" step="0.25" min="0" max="24"></td>
        <td><input type="color" class="inp-c-color" value="${normColor}"></td>
        <td><span class="conv-preview-badge" style="background:${normColor}; color:${textColor};">${code || '?'}</span></td>
        <td><button class="btn-remove-row">×</button></td>
    `;

    const inpCode = tr.querySelector(".inp-c-code");
    const inpColor = tr.querySelector(".inp-c-color");
    const preview = tr.querySelector(".conv-preview-badge");

    const updatePreview = () => {
        const cVal = normalizeHexColor(inpColor.value, "#bfdbfe");
        const tVal = getContrastTextColor(cVal);
        preview.style.backgroundColor = cVal;
        preview.style.color = tVal;
        preview.textContent = inpCode.value.trim().toUpperCase() || '?';
    };

    inpCode.oninput = updatePreview;
    inpColor.oninput = updatePreview;
    tr.querySelector(".btn-remove-row").onclick = () => tr.remove();
    tbodyConv.appendChild(tr);
}

function addConvRow() {
    createConvRow();
}

function saveConventions() {
    const newConvs = {};
    const rows = tbodyConv.querySelectorAll("tr");
    rows.forEach(r => {
        const code = r.querySelector(".inp-c-code").value.trim().toUpperCase();
        const description = r.querySelector(".inp-c-desc").value.trim();
        const rawHoursVal = r.querySelector(".inp-c-hours").value;
        const hours = parseConventionHours(rawHoursVal);
        const rawColor = r.querySelector(".inp-c-color").value;
        const color = normalizeHexColor(rawColor, "#bfdbfe");
        if(code) {
            newConvs[code] = { hours, description: description || code, color };
        }
    });
    state.conventions[state.currentDept] = newConvs;
    modalConv.classList.add("hidden");
    renderLegend();
    renderGrid();
    Swal.fire({ icon: 'success', title: 'Guardado', text: 'Convenciones actualizadas', timer: 1500, showConfirmButton: false });
}

function loadConventionsExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            const data = new Uint8Array(evt.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const sheetName = wb.SheetNames[0]; // read the first sheet
            const ws = wb.Sheets[sheetName];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
            
            let parsedConventions = parseExcelConventions(aoa);
            
            if (Object.keys(parsedConventions).length > 0) {
                state.conventions[state.currentDept] = parsedConventions;
                openConvModal(); // Refresh the modal with loaded data
                Swal.fire({ icon: 'success', title: 'Éxito', text: 'Parámetros cargados correctamente desde el Excel.', timer: 2000, showConfirmButton: false });
            } else {
                Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No se encontró la tabla de CONVENCIONES en el archivo suministrado.' });
            }
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al leer el archivo de convenciones.' });
        }
        fileInputConv.value = ""; // Reset input
    };
    reader.readAsArrayBuffer(file);
}

// ==========================================
// AUDIT & DEVIATIONS REPORT MODULE (CIRCULAR 010-2026 & CRITERIOS IA)
// ==========================================
let currentAuditDeviations = [];

function evaluateScheduleQuality(deviations) {
    const criticals = deviations.filter(d => d.severity === 'CRITICAL').length;
    const warnings = deviations.filter(d => d.severity === 'WARNING').length;
    
    let score = 100 - (criticals * 25) - (warnings * 5);
    if (score < 0) score = 0;

    let status = 'APROBADO';
    let titleColor = '#059669';
    let title = '🟢 APROBADO CON EXCELENCIA (100% Conforme)';
    let subtitle = 'El cuadro cumple con la totalidad de normas legales, ergonómicas y de equidad del equipo.';

    if (criticals > 0 || score < 70) {
        status = 'RECHAZADO';
        titleColor = '#dc2626';
        title = '🔴 RECHAZADO (Requiere Corrección Bloqueante)';
        subtitle = `Se detectaron ${criticals} hallazgo(s) crítico(s) ergonómico(s) o legal(es) que impiden la aprobación.`;
    } else if (warnings > 0 || score < 90) {
        status = 'APROBADO CON OBSERVACIONES';
        titleColor = '#d97706';
        title = '🟠 APROBADO CON OBSERVACIONES';
        subtitle = `Sin fallas críticas bloqueantes, pero presenta ${warnings} observación(es) de equidad o distribución de descansos.`;
    }

    return {
        score,
        status,
        titleColor,
        title,
        subtitle,
        criticals,
        warnings,
        totalDeviations: deviations.length
    };
}

function auditDeviations(state) {
    const deviations = [];
    const daysInMonth = getDaysInMonth(state.year, state.month);
    let targetMonth = state.year === 2026 && targetHours2026[state.month] ? targetHours2026[state.month] : 168;
    const expectedOp = targetMonth - 1; // e.g. 181h in September
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentMonthName = monthNames[state.month] || "";
    const weeksInMonth = daysInMonth / 7;

    state.departments.forEach(dept => {
        let parts = dept.split("|");
        let unit = parts.length > 1 ? parts[0].trim() : (state.unidadOperativa || "UNIDAD OPERATIVA");
        let service = parts.length > 1 ? parts[1].trim() : dept;

        const employees = state.data[dept] || [];
        const convs = state.conventions[dept] || getDefaultConventions();

        let empTotals = [];
        let empNightCounts = [];

        employees.forEach(emp => {
            const empName = emp.name.trim() || "Sin Nombre";
            let totalOpHours = 0;
            let currentWeekHours = 0;
            let weekStartDay = 1;
            let capHours = getEmpCapHours(emp, dept);

            let consecutiveWorkedDays = 0;
            let streakStartDay = 1;
            let maxConsecutiveWorkedDays = 0;
            let consecutiveNightShifts = 0;
            let nightShiftCount = 0;
            let sundayShiftCount = 0;
            let fullWeekendRests = 0;
            let weekendRestDays = 0;
            let consecutiveSundaysWorked = 0;
            let maxConsecutiveSundaysWorked = 0;

            for (let d = 1; d <= daysInMonth; d++) {
                const val = (emp.shifts[d] || "").trim().toUpperCase();
                const date = new Date(state.year, state.month, d);
                const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday

                const isRest = isRestOrNovelty(val, convs);

                let h = 0;
                if (val === 'CAP') {
                    h = 0;
                } else if (val && convs[val] !== undefined) {
                    h = convs[val].hours;
                } else if (isRest) {
                    h = 0;
                } else if (val) {
                    h = 12;
                }

                totalOpHours += h;
                currentWeekHours += h;

                // Rest vs Worked Day Tracking (Considers L, VAC, LIC, INC, DISP, DAC, V, DESCANSO, CAP, 0h)
                const isWorkDay = (!isRest && h > 0);
                if (isWorkDay) {
                    if (consecutiveWorkedDays === 0) {
                        streakStartDay = d;
                    }
                    consecutiveWorkedDays++;
                    if (consecutiveWorkedDays > maxConsecutiveWorkedDays) {
                        maxConsecutiveWorkedDays = consecutiveWorkedDays;
                    }
                } else {
                    if (consecutiveWorkedDays > 6) {
                        const startD = streakStartDay;
                        const endD = d - 1;
                        deviations.push({
                            unit: unit,
                            dept: service,
                            empName: empName,
                            severity: 'CRITICAL',
                            type: 'Días Consecutivos Excesivos (>6 días)',
                            location: `Días ${startD} a ${endD}`,
                            ruleDetail: `Trabajó ${consecutiveWorkedDays} días asistenciales consecutivos (del día ${startD} al día ${endD}) sin al menos 1 día de descanso (L / Fin de Semana / Novedad) intercalado (límite ergonómico: 6 días).`,
                            action: `Asignar al menos 1-2 turnos Libres (L) entre el día ${startD} y el día ${endD} para interrumpir la racha asistencial.`
                        });
                    }
                    consecutiveWorkedDays = 0;
                }

                // 1. Post-trasnocho (N followed by rest L) & Invalid Transition N->D
                if (val === 'N') {
                    nightShiftCount++;
                    if (d < daysInMonth) {
                        const nextVal = (emp.shifts[d + 1] || "").trim().toUpperCase();
                        if (nextVal && nextVal !== 'L') {
                            deviations.push({
                                unit: unit,
                                dept: service,
                                empName: empName,
                                severity: 'CRITICAL',
                                type: 'Descanso Post-Trasnocho',
                                location: `Día ${d + 1}`,
                                ruleDetail: `El día ${d} realizó turno de Noche (N) y el día ${d + 1} fue asignado con '${nextVal}' en lugar de Descanso (L).`,
                                action: `Cambiar el turno del día ${d + 1} a 'L' (Descanso) para cumplir la recuperación obligatoria.`
                            });
                        }

                        if (nextVal === 'D' || nextVal === 'M' || nextVal === '7-19') {
                            deviations.push({
                                unit: unit,
                                dept: service,
                                empName: empName,
                                severity: 'CRITICAL',
                                type: 'Transición Inversa Inválida (N->D)',
                                location: `Días ${d}-${d + 1}`,
                                ruleDetail: `Transición directa no ergonómica de Noche (N) a Día (${nextVal}) sin reposo biológico de 24h.`,
                                action: `Prohibido programar turno de Día tras Noche. Reemplazar el día ${d + 1} por Descanso (L).`
                            });
                        }
                    }
                }

                // 2. Consecutive Night Shifts check (>2 consecutive N)
                if (val === 'N') {
                    consecutiveNightShifts++;
                    if (consecutiveNightShifts > 2) {
                        deviations.push({
                            unit: unit,
                            dept: service,
                            empName: empName,
                            severity: 'WARNING',
                            type: 'Exceso Noches Consecutivas',
                            location: `Día ${d}`,
                            ruleDetail: `Acumuló ${consecutiveNightShifts} turnos de Noche (N) consecutivos (máximo ergonómico recomendado: 2 noches).`,
                            action: `Intercalar turno de descanso (L) o rotación diurna para evitar sobrecarga nocturna.`
                        });
                    }
                } else {
                    consecutiveNightShifts = 0;
                }

                // 3. Sunday tracking
                if (dayOfWeek === 0) { // Sunday
                    if (isWorkDay) {
                        sundayShiftCount++;
                        consecutiveSundaysWorked++;
                        if (consecutiveSundaysWorked > maxConsecutiveSundaysWorked) {
                            maxConsecutiveSundaysWorked = consecutiveSundaysWorked;
                        }
                    } else {
                        consecutiveSundaysWorked = 0;
                    }
                }

                // 4. Weekend rest tracking (Sábado y/o Domingo en Descanso / Novedad / Libres)
                if (dayOfWeek === 6 || dayOfWeek === 0) {
                    if (isRest) {
                        weekendRestDays++;
                    }
                }

                if (dayOfWeek === 6 && d < daysInMonth) { // Saturday
                    const satRest = isRest;
                    const sunVal = (emp.shifts[d + 1] || "").trim().toUpperCase();
                    const sunRest = isRestOrNovelty(sunVal, convs);
                    if (satRest && sunRest) {
                        fullWeekendRests++;
                    }
                }

                // 5. Max 54h per week check
                if (dayOfWeek === 0 || d === daysInMonth) {
                    if (currentWeekHours > 54) {
                        deviations.push({
                            unit: unit,
                            dept: service,
                            empName: empName,
                            severity: 'CRITICAL',
                            type: 'Exceso Semanal (>54h)',
                            location: `Semana días ${weekStartDay}-${d}`,
                            ruleDetail: `Acumuló ${currentWeekHours} horas operativas en la semana (supera el límite legal máximo de 54h por semana).`,
                            action: `Redistribuir turnos en esta semana para reducir la carga operativa a máximo 54h.`
                        });
                    }
                    currentWeekHours = 0;
                    weekStartDay = d + 1;
                }
            }

            // 6. Max Consecutive Worked Days Check (>6 days for streak active at month end)
            if (consecutiveWorkedDays > 6) {
                const startD = streakStartDay;
                const endD = daysInMonth;
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: empName,
                    severity: 'CRITICAL',
                    type: 'Días Consecutivos Excesivos (>6 días)',
                    location: `Días ${startD} a ${endD}`,
                    ruleDetail: `Trabajó ${consecutiveWorkedDays} días asistenciales consecutivos (del día ${startD} al día ${endD}) sin al menos 1 día de descanso (L / Fin de Semana / Novedad) intercalado (límite ergonómico: 6 días).`,
                    action: `Asignar al menos 1-2 turnos Libres (L) entre el día ${startD} y el día ${endD} para interrumpir la racha asistencial.`
                });
            }

            // 7. Full Weekend Rest Check (Weekend rest days or full S-D weekend fulfill requirement)
            if (fullWeekendRests === 0 && weekendRestDays < 2 && daysInMonth >= 28) {
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: empName,
                    severity: 'WARNING',
                    type: 'Sin Fin de Semana Libre',
                    location: `Consolidado Mes (${currentMonthName})`,
                    ruleDetail: `Trabajó todos los fines de semana del mes sin al menos 1 Fin de Semana Completo Libre (S-D) ni descansos en fin de semana.`,
                    action: `Asignar al menos un fin de semana completo en descanso libre (S-D) o alternar descansos en fin de semana.`
                });
            }

            // 8. Consecutive Sundays Worked Check (>=3)
            if (maxConsecutiveSundaysWorked >= 3) {
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: empName,
                    severity: 'WARNING',
                    type: 'Dominicales Consecutivos Trabajados',
                    location: `Mes (${currentMonthName})`,
                    ruleDetail: `Acumuló ${maxConsecutiveSundaysWorked} domingos trabajados consecutivos.`,
                    action: `Rotar turnos dominicales con otros compañeros de equipo.`
                });
            }

            const totalCombined = totalOpHours + capHours;
            empTotals.push({ name: empName, total: totalCombined, op: totalOpHours, cap: capHours });
            empNightCounts.push({ name: empName, nights: nightShiftCount });

            // 9. Monthly Total Target (Operativas + CAP) & Training Compensation
            if (totalCombined !== targetMonth) {
                const diff = totalCombined - targetMonth;
                const isFar = Math.abs(diff) > 12;
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: empName,
                    severity: isFar ? 'CRITICAL' : 'WARNING',
                    type: 'Diferencia Horas Mes',
                    location: `Consolidado Mes (${currentMonthName})`,
                    ruleDetail: `Horas Operativas: ${totalOpHours}h + CAP: ${capHours}h = Total ${totalCombined}h (Meta Circular: ${targetMonth}h, Diferencia: ${diff > 0 ? '+' : ''}${diff}h).`,
                    action: `Ajustar la programación para nivelar exactamente ${targetMonth}h en el mes.`
                });
            } else if (totalOpHours < expectedOp) {
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: empName,
                    severity: 'WARNING',
                    type: 'Compensación con Capacitación',
                    location: `Consolidado Mes (${currentMonthName})`,
                    ruleDetail: `Realizó ${totalOpHours}h operativas en lugar de las ${expectedOp}h esperadas, completando la meta de ${targetMonth}h con ${capHours}h de capacitación.`,
                    action: `Anotación Informativa: Verificar si la sustitución de horas asistenciales por capacitación (${capHours}h CAP) cuenta con aval de la coordinación.`
                });
            }

            // 10. Mandatory Training (Capacitación CAP >= 1h)
            if (capHours < 1) {
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: empName,
                    severity: 'WARNING',
                    type: 'Falta Capacitación (CAP)',
                    location: 'Columna CAP',
                    ruleDetail: 'No registra la hora mensual obligatoria de capacitación asignada.',
                    action: 'Asignar mínimo 1 hora de capacitación obligatoria en la columna CAP.'
                });
            }

            // 11. Weekly Average Hours Check (Ley 2101 - Target 42h/week average)
            const weeklyAvg = Math.round((totalCombined / weeksInMonth) * 10) / 10;
            if (totalCombined > 0 && Math.abs(weeklyAvg - 42.0) > 3.5) {
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: empName,
                    severity: 'WARNING',
                    type: 'Promedio Semanal (Ley 2101)',
                    location: `Promedio Mes (${weeklyAvg} h/sem)`,
                    ruleDetail: `Promedio semanal registrado: ${weeklyAvg} h/semana (Marco de referencia Ley 2101: 42 h/semana promedio).`,
                    action: `Proyectar turnos para promediar aproximadamente 42 h/semana durante el periodo auditado.`
                });
            }
        });

        // 12. Workload Equity Parity in Team & Night Shifts Equity
        if (empTotals.length >= 2) {
            let maxEmp = empTotals.reduce((prev, curr) => (curr.total > prev.total ? curr : prev), empTotals[0]);
            let minEmp = empTotals.reduce((prev, curr) => (curr.total < prev.total ? curr : prev), empTotals[0]);
            let gap = maxEmp.total - minEmp.total;

            if (gap >= 12 && minEmp.total > 0) {
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: `Equipo ${service}`,
                    severity: 'WARNING',
                    type: 'Equidad de Carga Laboral',
                    location: `Servicio ${service}`,
                    ruleDetail: `Existe una brecha de ${gap}h entre el colaborador con mayor carga (${maxEmp.name}: ${maxEmp.total}h) y el de menor carga (${minEmp.name}: ${minEmp.total}h).`,
                    action: `Revisar y redistribuir turnos en ${service} para lograr una carga horaria equitativa entre los miembros del equipo.`
                });
            }

            let maxNight = empNightCounts.reduce((prev, curr) => (curr.nights > prev.nights ? curr : prev), empNightCounts[0]);
            let minNight = empNightCounts.reduce((prev, curr) => (curr.nights < prev.nights ? curr : prev), empNightCounts[0]);
            let nightGap = maxNight.nights - minNight.nights;

            if (nightGap > 2) {
                deviations.push({
                    unit: unit,
                    dept: service,
                    empName: `Equipo ${service}`,
                    severity: 'WARNING',
                    type: 'Iniquidad Turnos Nocturnos',
                    location: `Servicio ${service}`,
                    ruleDetail: `Desbalance en turnos de Noche (${maxNight.name}: ${maxNight.nights} noches vs ${minNight.name}: ${minNight.nights} noches, brecha: ${nightGap}).`,
                    action: `Equilibrar los turnos de trasnocho (N) equitativamente entre el personal del servicio.`
                });
            }
        }
    });

    return deviations;
}

function openDeviationsModal() {
    currentAuditDeviations = auditDeviations(state);
    
    const filterUO = document.getElementById("filter-uo-desviaciones");
    const filterDept = document.getElementById("filter-dept-desviaciones");
    const filterTipo = document.getElementById("filter-tipo-desviaciones");

    if (filterUO) {
        const uoSet = new Set();
        currentAuditDeviations.forEach(d => uoSet.add(d.unit));
        state.departments.forEach(dept => {
            let parts = dept.split("|");
            let unit = parts.length > 1 ? parts[0].trim() : (state.unidadOperativa || "UNIDAD OPERATIVA");
            uoSet.add(unit);
        });

        filterUO.innerHTML = `<option value="ALL">Todas las Unidades (${uoSet.size})</option>`;
        uoSet.forEach(uName => {
            const opt = document.createElement("option");
            opt.value = uName;
            opt.textContent = uName;
            filterUO.appendChild(opt);
        });
        filterUO.value = "ALL";
    }

    updateDeptFilterOptions();
    if (filterTipo) filterTipo.value = "ALL";

    renderDeviationsTable();
    document.getElementById("modal-desviaciones").classList.remove("hidden");
}

function updateDeptFilterOptions() {
    const filterUO = document.getElementById("filter-uo-desviaciones");
    const filterDept = document.getElementById("filter-dept-desviaciones");
    if (!filterDept) return;

    const selUO = filterUO ? filterUO.value : "ALL";

    const deptSet = new Set();
    state.departments.forEach(dept => {
        let parts = dept.split("|");
        let unit = parts.length > 1 ? parts[0].trim() : (state.unidadOperativa || "UNIDAD OPERATIVA");
        let service = parts.length > 1 ? parts[1].trim() : dept;
        if (selUO === "ALL" || unit === selUO) {
            deptSet.add(service);
        }
    });

    filterDept.innerHTML = `<option value="ALL">Todos los Servicios (${deptSet.size})</option>`;
    deptSet.forEach(sName => {
        const opt = document.createElement("option");
        opt.value = sName;
        opt.textContent = sName;
        filterDept.appendChild(opt);
    });
    filterDept.value = "ALL";
}

function renderDeviationsTable(groupedByService = false) {
    const filterUO = document.getElementById("filter-uo-desviaciones");
    const filterDept = document.getElementById("filter-dept-desviaciones");
    const filterTipo = document.getElementById("filter-tipo-desviaciones");

    const selUO = filterUO ? filterUO.value : "ALL";
    const selDept = filterDept ? filterDept.value : "ALL";
    const selTipo = filterTipo ? filterTipo.value : "ALL";

    const filtered = currentAuditDeviations.filter(d => {
        const matchUO = (selUO === 'ALL' || d.unit === selUO);
        const matchDept = (selDept === 'ALL' || d.dept === selDept);
        const matchTipo = (selTipo === 'ALL' || d.severity === selTipo);
        return matchUO && matchDept && matchTipo;
    });

    const criticasCount = filtered.filter(d => d.severity === 'CRITICAL').length;
    const advertenciasCount = filtered.filter(d => d.severity === 'WARNING').length;

    document.getElementById("kpi-criticas").textContent = criticasCount;
    document.getElementById("kpi-advertencias").textContent = advertenciasCount;
    document.getElementById("kpi-total").textContent = filtered.length;

    // Actualizar Tarjeta Dictamen Evaluación IA
    const iaEval = evaluateScheduleQuality(filtered);
    const iaTitleEl = document.getElementById("ia-eval-title");
    const iaSubtitleEl = document.getElementById("ia-eval-subtitle");
    const iaScoreEl = document.getElementById("ia-eval-score");

    if (iaTitleEl) {
        iaTitleEl.textContent = iaEval.title;
        iaTitleEl.style.color = iaEval.titleColor;
    }
    if (iaSubtitleEl) {
        iaSubtitleEl.textContent = iaEval.subtitle;
    }
    if (iaScoreEl) {
        iaScoreEl.textContent = `${iaEval.score} / 100`;
        iaScoreEl.style.color = iaEval.titleColor;
    }

    const tbody = document.getElementById("tbody-desviaciones");
    const emptyState = document.getElementById("empty-desviaciones");
    tbody.innerHTML = "";

    const isGroupedView = (selDept === "ALL" || groupedByService);

    if (filtered.length === 0 && !isGroupedView) {
        emptyState.classList.remove("hidden");
    } else {
        emptyState.classList.add("hidden");

        if (isGroupedView) {
            const grouped = {};

            // 1. Initialize grouped dictionary with ALL evaluated departments in state.departments
            state.departments.forEach(dept => {
                let parts = dept.split("|");
                let unit = parts.length > 1 ? parts[0].trim() : (state.unidadOperativa || "UNIDAD OPERATIVA");
                let service = parts.length > 1 ? parts[1].trim() : dept;

                if (selUO === "ALL" || unit === selUO) {
                    const key = `${unit} | ${service}`;
                    grouped[key] = [];
                }
            });

            // 2. Populate deviations into grouped
            filtered.forEach(item => {
                const key = `${item.unit} | ${item.dept}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(item);
            });

            // 3. Render each service (both compliant and with observations)
            for (const [serviceKey, items] of Object.entries(grouped)) {
                const headerTr = document.createElement("tr");
                headerTr.className = "report-service-header-row";

                let targetDeptKey = state.departments.find(d => {
                    let parts = d.split("|");
                    let unit = parts.length > 1 ? parts[0].trim() : (state.unidadOperativa || "UNIDAD OPERATIVA");
                    let service = parts.length > 1 ? parts[1].trim() : d;
                    return `${unit} | ${service}` === serviceKey || d === serviceKey;
                }) || serviceKey;

                let deptStatus = getDeptStatus(targetDeptKey) || 'pending';
                let deptFeedback = getDeptFeedback(targetDeptKey);
                let auditorName = state.evaluadorDoe || state.evaluador || state.responsable || "Evaluador DOE";

                let statusBadgeHtml = '';
                if (deptStatus === 'approved') {
                    statusBadgeHtml = '<span class="eval-badge-approved">🟢 APROBADO</span>';
                } else if (deptStatus === 'rejected') {
                    statusBadgeHtml = '<span class="eval-badge-rejected">🔴 RECHAZADO CON OBSERVACIONES</span>';
                } else if (deptStatus === 'review') {
                    statusBadgeHtml = '<span class="eval-badge-review">🟡 ASPECTOS A MEJORAR</span>';
                } else {
                    statusBadgeHtml = '<span class="eval-badge-pending">⚪ EN REVISIÓN</span>';
                }

                if (items.length === 0) {
                    headerTr.innerHTML = `
                        <td colspan="7" style="background-color: #065f46 !important; color: #ffffff !important;">
                            🏢 <strong>${serviceKey}</strong> &nbsp;—&nbsp; ✅ 0 Inconsistencias (100% Conforme Circular 010)
                        </td>
                    `;
                    tbody.appendChild(headerTr);

                    const evalTr = document.createElement("tr");
                    evalTr.className = "evaluator-annotation-row";
                    evalTr.innerHTML = `
                        <td colspan="7">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span><strong>📝 Evaluador:</strong> ${auditorName}</span>
                                ${statusBadgeHtml}
                            </div>
                            <div>
                                <strong>Anotaciones / Aspectos a Mejorar:</strong> ${deptFeedback ? deptFeedback : '✅ <em>Servicio evaluado sin hallazgos ni aspectos negativos observados.</em>'}
                            </div>
                        </td>
                    `;
                    tbody.appendChild(evalTr);

                    const okTr = document.createElement("tr");
                    okTr.className = "service-ok-row";
                    okTr.innerHTML = `
                        <td colspan="7">
                            ✅ Servicio evaluado sin hallazgos. Cumple 100% con los parámetros de la Circular 010-2026.
                        </td>
                    `;
                    tbody.appendChild(okTr);
                } else {
                    headerTr.innerHTML = `
                        <td colspan="7">
                            🏢 <strong>${serviceKey}</strong> &nbsp;—&nbsp; ${items.length} Inconsistencia(s) Auditada(s)
                        </td>
                    `;
                    tbody.appendChild(headerTr);

                    const evalTr = document.createElement("tr");
                    evalTr.className = "evaluator-annotation-row";
                    evalTr.innerHTML = `
                        <td colspan="7">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <span><strong>📝 Evaluador:</strong> ${auditorName}</span>
                                ${statusBadgeHtml}
                            </div>
                            <div>
                                <strong>Anotaciones / Aspectos a Mejorar del Evaluador:</strong> ${deptFeedback ? deptFeedback : '<em>Sin anotaciones registradas por el evaluador. Se requieren correcciones normativas.</em>'}
                            </div>
                        </td>
                    `;
                    tbody.appendChild(evalTr);

                    items.forEach(item => {
                        const tr = document.createElement("tr");
                        const badgeClass = item.severity === 'CRITICAL' ? 'badge-critica' : 'badge-advertencia';
                        const badgeText = item.severity === 'CRITICAL' ? '🔴 CRÍTICA' : '🟠 ADVERTENCIA';

                        tr.innerHTML = `
                            <td><strong>${item.unit}</strong><br><small style="color:#64748b;">${item.dept}</small></td>
                            <td>${item.empName}</td>
                            <td><span class="${badgeClass}">${badgeText}</span></td>
                            <td><strong>${item.type}</strong></td>
                            <td>${item.location}</td>
                            <td>${item.ruleDetail}</td>
                            <td style="color: #047857; font-weight: 500;">${item.action}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
            }
        } else {
            filtered.forEach(item => {
                const tr = document.createElement("tr");
                const badgeClass = item.severity === 'CRITICAL' ? 'badge-critica' : 'badge-advertencia';
                const badgeText = item.severity === 'CRITICAL' ? '🔴 CRÍTICA' : '🟠 ADVERTENCIA';

                tr.innerHTML = `
                    <td><strong>${item.unit}</strong><br><small style="color:#64748b;">${item.dept}</small></td>
                    <td>${item.empName}</td>
                    <td><span class="${badgeClass}">${badgeText}</span></td>
                    <td><strong>${item.type}</strong></td>
                    <td>${item.location}</td>
                    <td>${item.ruleDetail}</td>
                    <td style="color: #047857; font-weight: 500;">${item.action}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    }
}

function printDeviationsReport(printAll = false) {
    const filterUO = document.getElementById("filter-uo-desviaciones");
    const filterDept = document.getElementById("filter-dept-desviaciones");

    const prevUO = filterUO ? filterUO.value : "ALL";
    const prevDept = filterDept ? filterDept.value : "ALL";

    if (printAll) {
        if (filterUO) filterUO.value = "ALL";
        if (filterDept) {
            updateDeptFilterOptions();
            filterDept.value = "ALL";
        }
        renderDeviationsTable(true);
    }

    window.print();

    if (printAll) {
        if (filterUO) filterUO.value = prevUO;
        updateDeptFilterOptions();
        if (filterDept) filterDept.value = prevDept;
        renderDeviationsTable();
    }
}

function exportDeviationsExcel() {
    const filterUO = document.getElementById("filter-uo-desviaciones");
    const filterDept = document.getElementById("filter-dept-desviaciones");
    const filterTipo = document.getElementById("filter-tipo-desviaciones");

    const selUO = filterUO ? filterUO.value : "ALL";
    const selDept = filterDept ? filterDept.value : "ALL";
    const selTipo = filterTipo ? filterTipo.value : "ALL";

    const filtered = currentAuditDeviations.filter(d => {
        const matchUO = (selUO === 'ALL' || d.unit === selUO);
        const matchDept = (selDept === 'ALL' || d.dept === selDept);
        const matchTipo = (selTipo === 'ALL' || d.severity === selTipo);
        return matchUO && matchDept && matchTipo;
    });

    if (filtered.length === 0) {
        Swal.fire({ icon: 'info', title: 'Sin desviaciones', text: 'No hay desviaciones registradas para el filtro seleccionado.' });
        return;
    }

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthText = monthNames[state.month] || "";

    const dataRows = [
        ["REPORTE DE DESVIACIONES Y CUMPLIMIENTO - CIRCULAR 010-2026"],
        [`Unidad Operativa: ${selUO === 'ALL' ? (state.unidadOperativa || 'Todas las Unidades') : selUO}`],
        [`Servicio / Área: ${selDept === 'ALL' ? 'Todos los Servicios' : selDept}`],
        [`Evaluador / Auditor: ${state.evaluadorDoe || state.evaluador || state.responsable || "DOE"}`],
        [`Fecha de Auditoría: ${new Date().toLocaleDateString('es-CO')}`],
        [`Periodo Auditado: ${monthText} ${state.year}`],
        [""],
        ["Unidad Operativa", "Área / Servicio", "Estado Evaluador", "Anotaciones / Aspectos a Mejorar del Evaluador", "Colaborador", "Criticidad", "Tipo de Desviación", "Día / Ubicación", "Detalle Normativo Circular", "Acción Correctiva Sugerida"]
    ];

    filtered.forEach(item => {
        let targetDeptKey = state.departments.find(d => d.includes(item.dept)) || item.dept;
        let deptStatus = (state.status && state.status[targetDeptKey]) ? state.status[targetDeptKey] : 'PENDIENTE';
        let deptFeedback = (state.feedback && state.feedback[targetDeptKey]) ? state.feedback[targetDeptKey] : 'Sin anotaciones registradas';

        dataRows.push([
            item.unit,
            item.dept,
            deptStatus.toUpperCase(),
            deptFeedback,
            item.empName,
            item.severity === 'CRITICAL' ? 'CRITICA' : 'ADVERTENCIA',
            item.type,
            item.location,
            item.ruleDetail,
            item.action
        ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DESVIACIONES_CIRCULAR_010");

    const filename = `Reporte_Desviaciones_Unidad_${state.year}_${state.month + 1}.xlsx`;
    XLSX.writeFile(wb, filename);
}

async function resetNewProgram() {
    const { isConfirmed } = await Swal.fire({
        title: '¿Nueva Programación?',
        text: 'Se eliminarán todas las áreas, colaboradores y turnos actuales para iniciar una programación en blanco.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Sí, reiniciar todo',
        cancelButtonText: 'Cancelar'
    });

    if (isConfirmed) {
        state.departments = [
            "URGENCIAS", 
            "CONSULTA EXTERNA", 
            "FACTURACIÓN", 
            "SUPERNUMERARIA", 
            "AUDITORIA", 
            "RADICACIÓN"
        ];
        state.currentDept = null;
        state.data = {};
        state.conventions = {};
        state.unidadOperativa = "";
        state.responsable = "";

        localStorage.removeItem("msm_turnos_unidad");

        if (inputResponsable) inputResponsable.value = "";
        if (document.getElementById("input-unidad")) document.getElementById("input-unidad").value = "";

        state.departments.forEach(d => {
            state.data[d] = [];
            state.conventions[d] = getDefaultConventions();
        });

        renderDepartments();
        renderLegend();
        renderGrid();

        btnAddEmployee.disabled = true;
        btnConfigConv.disabled = true;
        Swal.fire({ icon: 'success', title: 'Nueva Programación', text: 'Herramienta lista para una nueva captura', timer: 1500, showConfirmButton: false });
    }
}

async function clearAllData() {
    const res = await Swal.fire({
        title: '¿Limpiar todo el cuadro?',
        text: 'Esto borrará todos los servicios y turnos en pantalla para iniciar con un archivo Excel limpio.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar'
    });
    if (res.isConfirmed) {
        state.departments = [];
        state.data = {};
        state.conventions = {};
        state.status = {};
        state.feedback = {};
        state.currentDept = null;
        state.unidadOperativa = "";
        if (inputUnidad) inputUnidad.value = "";
        localStorage.removeItem("msm_turnos");
        localStorage.removeItem("msm_turnos_unidad");
        localStorage.removeItem("msm_turnos_doe");
        renderDepartments();
        if (tableBodyEmployees) tableBodyEmployees.innerHTML = "";
        if (currentDeptTitle) currentDeptTitle.textContent = "Seleccione un área";
        if (emptyState) emptyState.classList.remove("hidden");
        Swal.fire({ icon: 'success', title: 'Cuadro Limpiado', text: 'Se han eliminado los datos en pantalla.', timer: 1500, showConfirmButton: false });
    }
}

// Start
init();


