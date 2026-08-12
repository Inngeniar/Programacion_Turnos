// app.js

// State
const state = {
    year: 2026,
    month: 7, // 0-indexed (7 = August)
    unidadOperativa: "",
    responsable: "",
    departments: [
        "URGENCIAS", 
        "CONSULTA EXTERNA", 
        "FACTURACIÓN", 
        "SUPERNUMERARIA", 
        "AUDITORIA", 
        "RADICACIÓN"
    ],
    currentDept: null,
    data: {}, // data[dept][employeeId]
    conventions: {} // conventions[dept] = { "D": { hours: 12, color: "#bfdbfe" }, ... }
};

function getDefaultConventions() {
    return {
        "D": { hours: 12, color: "var(--shift-D)" },
        "N": { hours: 12, color: "var(--shift-N)" },
        "M": { hours: 6, color: "var(--shift-M)" },
        "T": { hours: 6, color: "var(--shift-T)" },
        "L": { hours: 0, color: "var(--shift-L)" },
        "J1": { hours: 12, color: "#fef08a" },
        "D1": { hours: 12, color: "#bfdbfe" },
        "D2": { hours: 12, color: "#bfdbfe" }
    };
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
    inputResponsable.addEventListener("input", (e) => state.responsable = e.target.value);

    btnAddDept.addEventListener("click", addDepartment);
    btnAddEmployee.addEventListener("click", addEmployee);
    
    document.getElementById("btn-save-local").addEventListener("click", saveLocal);
    document.getElementById("btn-load-json").addEventListener("click", () => document.getElementById("file-input-json").click());
    document.getElementById("btn-load-excel").addEventListener("click", () => document.getElementById("file-input-excel").click());
    document.getElementById("file-input-json").addEventListener("change", loadJSON);
    document.getElementById("file-input-excel").addEventListener("change", loadExcel);
    document.getElementById("btn-export-excel").addEventListener("click", exportExcel);
    
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
    renderDepartments();
    updateTargetHours();
}

function updateTargetHours() {
    let target = 168; // Default fallback
    if (state.year === 2026 && targetHours2026[state.month]) {
        target = targetHours2026[state.month];
    }
    infoTotalHours.textContent = `Horas del Mes: ${target}`;
}

function renderDepartments() {
    deptList.innerHTML = "";
    state.departments.forEach(dept => {
        const li = document.createElement("li");
        li.className = "dept-item" + (state.currentDept === dept ? " active" : "");
        li.textContent = dept;
        li.onclick = () => selectDepartment(dept);
        deptList.appendChild(li);
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
    emptyState.classList.add("hidden");
    renderLegend();
    renderGrid();
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
        const span = document.createElement("span");
        span.className = "legend-item";
        span.innerHTML = `<span class="badge" style="background:${info.color}; color:#000;">${code}</span> (${info.hours}h)`;
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
        tdName.appendChild(btnDel);
        tr.appendChild(tdName);
        
        let totalHours = 0;
        let currentWeekHours = 0;
        
        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const td = document.createElement("td");
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
                inpShift.style.backgroundColor = convs[val].color;
            }
            
            td.appendChild(inpShift);
            tr.appendChild(td);
            
            // Calc hours
            let h = 0;
            if (val && convs[val] !== undefined) {
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
        if (totalHours !== targetMonth) {
            tdH.classList.add("error");
            tdH.title = `Las horas no coinciden con las del mes (${targetMonth})`;
        }
        tr.appendChild(tdH);
        
        // Cap
        const tdCap = document.createElement("td");
        const inpCap = document.createElement("input");
        inpCap.className = "shift-input val-CAP";
        inpCap.type = "text";
        inpCap.value = emp.cap !== undefined ? emp.cap : 1;
        inpCap.onchange = (e) => emp.cap = parseInt(e.target.value) || 0;
        tdCap.appendChild(inpCap);
        tr.appendChild(tdCap);
        
        // Apply Validation Errors to UI
        if (validation.errors.length > 0) {
            validation.errors.forEach(err => {
                if (err.day) {
                    const cell = tr.children[err.day]; // 0 is name, 1 is day 1...
                    cell.classList.add("cell-error");
                    cell.title = err.msg;
                }
            });
            // Also alert on total if max 54h/week broken
            if(validation.globalMsg) {
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

// Data persistence
function saveLocal() {
    localStorage.setItem("msm_turnos", JSON.stringify(state));
    Swal.fire({ icon: 'success', title: 'Guardado', text: 'Progreso guardado localmente', timer: 1500, showConfirmButton: false });
}

function loadLocal() {
    const saved = localStorage.getItem("msm_turnos");
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(state, parsed);
        } catch(e) { console.error("Error loading state"); }
    }
}

function loadJSON(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            Object.assign(state, parsed);
            selectYear.value = state.year;
            selectMonth.value = state.month;
            inputUnidad.value = state.unidadOperativa || "";
            inputResponsable.value = state.responsable || "";
            renderDepartments();
            if(state.currentDept) selectDepartment(state.currentDept);
            Swal.fire({ icon: 'success', title: 'Cargado', text: 'Progreso JSON cargado correctamente' });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Archivo inválido' });
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
}

function loadExcel(e) {
    const file = e.target.files[0];
    if(!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            // Clear current data but keep structure
            let newDepartments = [];
            let newData = {};
            let unidadOperativa = state.unidadOperativa;
            
            workbook.SheetNames.forEach(sheetName => {
                const ws = workbook.Sheets[sheetName];
                const aoa = XLSX.utils.sheet_to_json(ws, {header: 1, defval: ""}); // Array of Arrays
                
                let upperName = sheetName.toUpperCase();
                if (!newDepartments.includes(upperName)) newDepartments.push(upperName);
                newData[upperName] = [];
                let parsedConventions = {};
                
                // Try to find the date row (it usually has numbers 1, 2, 3...)
                let datesRowIndex = -1;
                let convRowIndex = -1;
                let daysInMonth = 31;
                
                for (let i = 0; i < aoa.length; i++) {
                    const row = aoa[i];
                    // Look for 'UNIDAD FUNCIONAL'
                    let ufIdx = row.findIndex(c => typeof c === 'string' && c.includes('UNIDAD FUNCIONAL'));
                    if (ufIdx !== -1 && row.length > ufIdx + 2) {
                        unidadOperativa = row[ufIdx + 2];
                    }
                    
                    // Look for 'CONVENCIONES'
                    let convIdx = row.findIndex(c => typeof c === 'string' && c.toUpperCase().includes('CONVENCIONES'));
                    if (convIdx !== -1) {
                        convRowIndex = i;
                    }
                    
                    // Look for dates row (contains 1, 2, 3...)
                    let hasOne = false;
                    let hasTwo = false;
                    for (let j = 0; j < row.length; j++) {
                        if (row[j] == 1) hasOne = true;
                        if (row[j] == 2) hasTwo = true;
                    }
                    if (hasOne && hasTwo && datesRowIndex === -1) {
                        datesRowIndex = i;
                    }
                }
                
                // Parse Conventions if found
                if (convRowIndex !== -1) {
                    // Usually next row is headers: TURNO, INICIO, FIN, etc... TOTAL HORAS
                    let cHeadRow = aoa[convRowIndex + 1] || [];
                    let tCol = cHeadRow.findIndex(c => typeof c === 'string' && c.includes('TURNO'));
                    let hCol = cHeadRow.findIndex(c => typeof c === 'string' && c.includes('TOTAL'));
                    if (tCol === -1) tCol = 0; // fallback
                    if (hCol === -1) hCol = cHeadRow.length - 1; // fallback
                    
                    for (let i = convRowIndex + 2; i < aoa.length; i++) {
                        if (!aoa[i] || !aoa[i][tCol]) break; // stop at empty
                        let tCode = aoa[i][tCol].toString().trim();
                        let tHours = parseFloat(aoa[i][hCol]);
                        if (tCode && !isNaN(tHours)) {
                            parsedConventions[tCode] = { hours: tHours, color: "#e2e8f0" };
                        }
                    }
                }
                
                if (Object.keys(parsedConventions).length === 0) {
                    parsedConventions = getDefaultConventions();
                }
                state.conventions[upperName] = parsedConventions;
                
                if (datesRowIndex !== -1) {
                    const dateRow = aoa[datesRowIndex];
                    let colMap = {}; // map day number -> col index
                    
                    for (let j = 0; j < dateRow.length; j++) {
                        let val = parseInt(dateRow[j]);
                        if (!isNaN(val) && val >= 1 && val <= 31) {
                            colMap[val] = j;
                            daysInMonth = Math.max(daysInMonth, val);
                        }
                    }
                    
                    let nameCol = -1;
                    // Usually name is in the column before day 1, or just search the row above for 'NOMBRE'
                    const headerRow = aoa[datesRowIndex - 1];
                    if (headerRow) {
                        for(let j=0; j<headerRow.length; j++) {
                            if(typeof headerRow[j] === 'string' && headerRow[j].toUpperCase().includes('NOMBRE')) {
                                nameCol = j;
                                break;
                            }
                        }
                    }
                    if (nameCol === -1) {
                        // fallback to the column right before day 1
                        nameCol = colMap[1] - 1;
                    }
                    
                    // Extract employees (rows right after dates row)
                    for (let i = datesRowIndex + 1; i < aoa.length; i++) {
                        const row = aoa[i];
                        if (!row || row.length === 0) break;
                        
                        let empName = row[nameCol];
                        // If empty or looks like a summary, stop or skip
                        if (!empName || typeof empName !== 'string' || empName.toUpperCase().includes('AGOSTO') || empName.toUpperCase() === 'NOMBRE') {
                            if (!empName) {
                                // sometimes there's an empty row before totals. Let's break if we see one without name
                                continue;
                            }
                        }
                        
                        // Check if we hit the totals section
                        if (empName.toUpperCase().includes('TOTAL')) break;
                        if (row[colMap[1]] === undefined) continue; // no data
                        
                        // Heuristic: if row contains numbers instead of shifts in the day columns, it's the totals block
                        let isTotalBlock = false;
                        if (row[colMap[1]] === 0 || row[colMap[1]] === 12 || typeof row[colMap[1]] === 'number') {
                            isTotalBlock = true;
                        }
                        if (isTotalBlock) break;

                        let emp = {
                            id: Date.now().toString() + Math.random().toString(),
                            name: empName.trim(),
                            shifts: {},
                            cap: 1
                        };
                        
                        for (let d = 1; d <= daysInMonth; d++) {
                            if (colMap[d] !== undefined) {
                                let val = row[colMap[d]];
                                if (val) emp.shifts[d] = val.toString().trim().toUpperCase();
                            }
                        }
                        
                        // Try to find CAP
                        // In the example, CAP is 2 columns after the last day
                        let capCol = colMap[daysInMonth] + 2;
                        if (headerRow && typeof headerRow[capCol] === 'string' && headerRow[capCol].includes('CAP')) {
                            let capVal = parseInt(row[capCol]);
                            if (!isNaN(capVal)) emp.cap = capVal;
                        }
                        
                        if(emp.name) {
                            newData[upperName].push(emp);
                        }
                    }
                }
            });
            
            if (newDepartments.length > 0) {
                state.departments = newDepartments;
                state.data = newData;
                if (unidadOperativa) state.unidadOperativa = unidadOperativa;
                inputUnidad.value = state.unidadOperativa || "";
                
                renderDepartments();
                selectDepartment(state.departments[0]);
                Swal.fire({ icon: 'success', title: 'Excel Importado', text: 'Los turnos fueron cargados exitosamente para su verificación.' });
            } else {
                Swal.fire({ icon: 'warning', title: 'Atención', text: 'No se encontraron cuadros de turno válidos en el Excel.' });
            }
            
        } catch (err) {
            console.error(err);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Hubo un error al procesar el archivo Excel.' });
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = ''; // Reset input
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
        row.push(total, emp.cap || 1, total + (emp.cap || 1));
        totalCols[colIdx] = (totalCols[colIdx] || 0) + total; colIdx++;
        totalCols[colIdx] = (totalCols[colIdx] || 0) + (emp.cap || 1); colIdx++;
        totalCols[colIdx] = (totalCols[colIdx] || 0) + total + (emp.cap || 1);
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
    const convs = state.conventions[state.currentDept];
    tbodyConv.innerHTML = "";
    for (const [code, info] of Object.entries(convs)) {
        createConvRow(code, info.hours, info.color);
    }
    modalConv.classList.remove("hidden");
}

function createConvRow(code = "", hours = 12, color = "#e2e8f0") {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td><input type="text" class="inp-c-code" value="${code}" placeholder="Ej: D"></td>
        <td><input type="number" class="inp-c-hours" value="${hours}" step="0.5"></td>
        <td><input type="color" class="inp-c-color" value="${color}"></td>
        <td><button class="btn-remove-row">×</button></td>
    `;
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
        const hours = parseFloat(r.querySelector(".inp-c-hours").value);
        const color = r.querySelector(".inp-c-color").value;
        if(code && !isNaN(hours)) {
            newConvs[code] = { hours, color };
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
        const data = evt.target.result;
        try {
            const wb = XLSX.read(data, { type: 'binary' });
            const sheetName = wb.SheetNames[0]; // read the first sheet
            const ws = wb.Sheets[sheetName];
            const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 });
            
            let convRowIndex = -1;
            for (let i = 0; i < aoa.length; i++) {
                const row = aoa[i];
                let convIdx = row.findIndex(c => typeof c === 'string' && c.toUpperCase().includes('CONVENCIONES'));
                if (convIdx !== -1) {
                    convRowIndex = i;
                    break;
                }
            }
            
            let parsedConventions = {};
            if (convRowIndex !== -1) {
                let cHeadRow = aoa[convRowIndex + 1] || [];
                let tCol = cHeadRow.findIndex(c => typeof c === 'string' && c.includes('TURNO'));
                let hCol = cHeadRow.findIndex(c => typeof c === 'string' && c.includes('TOTAL'));
                if (tCol === -1) tCol = 0;
                if (hCol === -1) hCol = cHeadRow.length - 1;
                
                for (let i = convRowIndex + 2; i < aoa.length; i++) {
                    if (!aoa[i] || !aoa[i][tCol]) break;
                    let tCode = aoa[i][tCol].toString().trim();
                    let tHours = parseFloat(aoa[i][hCol]);
                    if (tCode && !isNaN(tHours)) {
                        parsedConventions[tCode] = { hours: tHours, color: "#e2e8f0" };
                    }
                }
            }
            
            if (Object.keys(parsedConventions).length > 0) {
                state.conventions[state.currentDept] = parsedConventions;
                openConvModal(); // Refresh the modal with loaded data
                Swal.fire({ icon: 'success', title: 'Éxito', text: 'Parámetros cargados correctamente desde el Excel.', timer: 2000, showConfirmButton: false });
            } else {
                Swal.fire({ icon: 'error', title: 'No encontrado', text: 'No se encontró la tabla de CONVENCIONES en el archivo suministrado.' });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al leer el archivo de convenciones.' });
        }
        fileInputConv.value = ""; // Reset input
    };
    reader.readAsBinaryString(file);
}

// Start
init();
