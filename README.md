# 🏥 Mundo Salud Médica — Sistema de Programación de Turnos

[![Versión](https://img.shields.io/badge/Versi%C3%B3n-2.0-blue.svg)](https://github.com/)
[![Licencia](https://img.shields.io/badge/Licencia-MIT-green.svg)](LICENSE)
[![Estado](https://img.shields.io/badge/Estado-Producci%C3%B3n-brightgreen.svg)](https://github.com/)
[![HTML5](https://img.shields.io/badge/Tecnolog%C3%ADa-HTML5%20%7C%20CSS3%20%7C%20JS-orange.svg)](https://developer.mozilla.org/)

Plataforma web unificada de **Mundo Salud Médica** para la planificación, validación horaria, auditoría y consolidación ejecutiva de cuadros de turnos asistenciales de personal médico y de enfermería.

---

## 📌 Descripción General

El **Sistema de Programación de Turnos** consta de dos herramientas independientes y complementarias diseñadas para garantizar el cumplimiento de las jornadas laborales institucionales, eliminando los errores manuales de conteo de horas y estandarizando el intercambio de información entre las Unidades Operativas y la Dirección de Operaciones y Enfermería (DOE).

### 🚀 Módulos Principales

1. **🏥 Generador de Turnos (Unidades Operativas)**:
   - Utilizado por coordinadores de unidad y jefes de servicio.
   - Creación interactiva de la matriz de turnos por colaborador.
   - Conteo automático de horas mensuales en tiempo real.
   - Respaldo de avance en almacenamiento local / JSON.
   - Exportación de cuadros de turno en formato oficial Excel (`.xlsx`) con estilos institucionales.

2. **🛡️ Consola DOE (Dirección de Operaciones y Enfermería)**:
   - Utilizado por la dirección de operaciones y auditores de enfermería.
   - Carga masiva e importación automática de archivos Excel generados por las Unidades Operativas.
   - Auditoría multi-servicio y verificación del cumplimiento horario.
   - Edición y personalización dinámica de convenciones horarias.
   - Aprobación o rechazo de cuadros de turnos y exportación consolidada para la liquidación de nómina.

3. **🏠 Portal de Inicio (`index.html`)**:
   - Punto de acceso centralizado que conecta ambos aplicativos.
   - Interfaz moderna basada en **Glassmorphism**, diseño responsive y accesos directos a manuales de usuario y circulares institucionales.

---

## 📁 Estructura del Repositorio

```text
Programacion_Turnos/
├── index.html                           # Portal principal de navegación (Hub)
├── README.md                            # Documentación general del repositorio
├── LICENSE                              # Licencia del proyecto (MIT)
├── CONTRIBUTING.md                      # Guía de contribución para desarrolladores
├── .gitignore                           # Exclusión de archivos temporales y del sistema
│
├── app_unidad/                          # Módulo para Unidades Operativas
│   ├── Generador_Turnos_Unidades.html   # Aplicación principal del Generador
│   ├── Manual_Usuario_Unidades.html     # Manual rápido e interactivo de usuario
│   ├── app.js                           # Lógica de cálculo, matriz y exportación Excel
│   └── styles.css                       # Sistema de diseño Glassmorphic (Unidades)
│
├── app_doe/                             # Módulo para la Dirección de Operaciones
│   ├── Consola_DOE.html                 # Aplicación principal de Auditoría DOE
│   ├── Manual_Usuario_DOE.html          # Manual rápido de auditoría y evaluación
│   ├── app.js                           # Lógica de importación Excel, auditoría y consolidación
│   └── styles.css                       # Sistema de diseño Glassmorphic (DOE)
│
├── docs/                                # Documentos institucionales y formatos
│   ├── CIRCULAR 010-2026...pdf          # Circular oficial con normas de programación
│   ├── 8.GTH-FT-038...xlsx              # Plantilla base institucional (Excel V2)
│   ├── Herramienta_Unidades.zip         # Paquete descargable para ejecuciones offline
│   └── Herramienta_DOE.zip              # Paquete descargable para la consola DOE
│
└── .github/                             # Plantillas y estándares de GitHub
    ├── CODE_OF_CONDUCT.md               # Código de conducta del proyecto
    ├── PULL_REQUEST_TEMPLATE.md         # Plantilla para Pull Requests
    └── ISSUE_TEMPLATE/
        ├── bug_report.md                # Plantilla para reporte de fallos
        └── feature_request.md           # Plantilla para sugerencia de funciones
```

---

## ⚡ Inicio Rápido

No se requiere instalación de servidores, compiladores ni dependencias externas (Node.js/npm). Toda la lógica se ejecuta directamente en el cliente (Browser Client-Side).

### Opción 1: Uso Local
1. Clona o descarga este repositorio en tu equipo:
   ```bash
   git clone https://github.com/tu-usuario/Programacion_Turnos.git
   ```
2. Haz doble clic en el archivo `index.html` ubicado en la raíz del proyecto. Se abrirá automáticamente en tu navegador web (Google Chrome, Microsoft Edge, Safari o Firefox).

### Opción 2: Despliegue en GitHub Pages
1. Ve a la sección **Settings** de tu repositorio en GitHub.
2. Navega a **Pages** y selecciona la rama `main` (o `master`) y la carpeta raíz (`/root`).
3. Guarda los cambios. Tu portal estará accesible públicamente en `https://<tu-usuario>.github.io/Programacion_Turnos/`.

---

## 🛠️ Tecnologías Utilizadas

- **HTML5 Semantic**: Estructuración accesible e intuitiva.
- **CSS3 Vanilla**: Estilos personalizados con variables CSS, animaciones fluidas, grid layout y efectos de **Glassmorphism** (`backdrop-filter`).
- **JavaScript Moderno (ES6+)**: Manipulación dinámica del DOM, gestión de archivos locales y eventos de interfaz.
- **[SheetJS / xlsx-js-style](https://github.com/gitbrent/xlsx-js-style)**: Lectura, escritura y generación de hojas de cálculo Excel (`.xlsx`) con preservación de estilos, colores de celdas y fórmulas.
- **[SweetAlert2](https://sweetalert2.github.io/)**: Modal de alertas e interactividad amigable con el usuario.
- **Google Fonts (Inter)**: Tipografía limpia y profesional para lectura de datos numéricos y calendarios.

---

## 📋 Convenciones de Turnos Estándar

| Convención | Descripción | Horas Asignadas | Color de Celda |
| :---: | :--- | :---: | :---: |
| **D** | Turno Día (7:00 a 19:00) | 12 hrs | Azul Claro (`#bfdbfe`) |
| **N** | Turno Noche (19:00 a 7:00) | 12 hrs | Azul Oscuro (`#1e3a8a`) |
| **M** | Turno Mañana (7:00 a 13:00) | 6 hrs | Amarillo (`#fef08a`) |
| **T** | Turno Tarde (13:00 a 19:00) | 6 hrs | Naranja (`#fed7aa`) |
| **L** | Día Libre / Descanso | 0 hrs | Gris (`#e2e8f0`) |
| **VAC** | Vacaciones | Según ley | Verde Claro |
| **INC** | Incapacidad | Según ley | Rojo Claro |

*(Nota: En ambas herramientas es posible personalizar el número de horas o crear nuevas convenciones en caso de jornadas especiales).*

---

## 📖 Manuales de Usuario y Documentación

- **Manual Generador de Unidades**: Consulta [`app_unidad/Manual_Usuario_Unidades.html`](file:///c:/Users/nicol/OneDrive/Mundo%20Salud%20M%C3%A9dica/PROYECTO%20MSM/Programacion_Turnos/app_unidad/Manual_Usuario_Unidades.html)
- **Manual Consola DOE**: Consulta [`app_doe/Manual_Usuario_DOE.html`](file:///c:/Users/nicol/OneDrive/Mundo%20Salud%20M%C3%A9dica/PROYECTO%20MSM/Programacion_Turnos/app_doe/Manual_Usuario_DOE.html)
- **Circular 010-2026**: Revisa las normativas en la carpeta [`docs/`](file:///c:/Users/nicol/OneDrive/Mundo%20Salud%20M%C3%A9dica/PROYECTO%20MSM/Programacion_Turnos/docs/)

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si deseas proponer mejoras en la interfaz, optimizaciones en el cálculo horarias o correcciones en el parseo de Excel, consulta la guía [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para obtener más detalles.

---

<p center align="center"><b>Mundo Salud Médica © 2026 — Dirección de Operaciones y Enfermería</b></p>
