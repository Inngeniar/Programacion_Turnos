# Guía de Contribución — Programación de Turnos

¡Gracias por tu interés en contribuir a las herramientas de **Mundo Salud Médica**!

Este documento proporciona pautas y lineamientos para enviar contribuciones al proyecto.

---

## 🛠️ Principios de Desarrollo

1. **Diseño Visual**:
   - Mantener el lenguaje de diseño **Glassmorphism**.
   - Respetar la paleta de colores institucional en `:root` (`--primary: #2563eb`, etc.).
   - Utilizar la fuente `Inter` de Google Fonts.
   - Garantizar respuesta fluida en diferentes resoluciones de pantalla.

2. **Cero Dependencias Backend**:
   - Toda la lógica debe ejecutarse directamente en el cliente (Browser Client-Side).
   - No añadir frameworks pesados o requerimientos de compilación previa si no es estrictamente necesario.

3. **Compatibilidad con Excel**:
   - La librería `xlsx-js-style` es la encargada de la manipulación de libros `.xlsx`.
   - Cualquier cambio en la estructura de celdas o resúmenes de horas debe ser probado tanto en el exportador del Generador de Unidades como en el importador de la Consola DOE.

---

## 📋 Proceso de Contribución

1. **Haz un Fork del Repositorio**
   Crea una copia de este repositorio en tu cuenta personal de GitHub.

2. **Crea una Rama (Feature Branch)**
   Utiliza nombres descriptivos para tus ramas:
   ```bash
   git checkout -b feature/nueva-funcionalidad-exportacion
   # o
   git checkout -b fix/correccion-conteo-horas
   ```

3. **Realiza tus Cambios y Pruebas**
   - Abre `index.html`, `Generador_Turnos_Unidades.html` y `Consola_DOE.html` en tu navegador.
   - Realiza pruebas de creación de colaboradores, asignación de turnos, guardado local, importación y exportación de archivos Excel.

4. **Haz Commit de tus Cambios**
   Escribe mensajes de commit claros y concisos en español o inglés:
   ```bash
   git commit -m "feat: agrega soporte para convenciones personalizadas en exportación Excel"
   ```

5. **Envía un Pull Request (PR)**
   - Completa la información solicitada en la plantilla de Pull Request.
   - Describe brevemente el objetivo del cambio y adjunta capturas de pantalla si modificaste elementos visuales.

---

## 🐛 Reporte de Errores (Bugs)

Si encuentras un error o inconsistencia en la herramienta:
1. Revisa las [Issues](../../issues) existentes para evitar duplicados.
2. Si el problema no ha sido reportado, abre una nueva **Issue** utilizando la plantilla `bug_report.md`.

---

## 💡 Sugerencia de Funcionalidades

Las sugerencias para mejorar el flujo de trabajo de la programación de turnos son siempre bienvenidas. Abre una **Issue** usando la plantilla `feature_request.md`.

¡Agradecemos tu valioso aporte para seguir mejorando las herramientas de Mundo Salud Médica!
