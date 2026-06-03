const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

class PdfMergerService {
    /**
     * Une una lista de archivos PDF en grupos de 2 y los guarda en un directorio de salida.
     * @param {Array<string>} inputFiles - Lista de rutas absolutas de los archivos PDF a unir.
     * @param {string} outputDir - Directorio donde se guardarán los PDFs unidos.
     * @returns {Promise<Object>} Resultado del proceso { success, generatedFiles, errors }.
     */
    async mergeInPairs(inputFiles, outputDir) {
        const generatedFiles = [];
        const errors = [];

        try {
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Procesar de 2 en 2
            for (let i = 0; i < inputFiles.length; i += 2) {
                const file1 = inputFiles[i];
                const file2 = inputFiles[i + 1]; // Puede ser undefined si es impar

                try {
                    // Crear un nuevo documento PDF
                    const mergedPdf = await PDFDocument.create();

                    // Procesar primer archivo
                    if (fs.existsSync(file1)) {
                        const pdfBytes1 = fs.readFileSync(file1);
                        const pdf1 = await PDFDocument.load(pdfBytes1);
                        const copiedPages1 = await mergedPdf.copyPages(pdf1, pdf1.getPageIndices());
                        copiedPages1.forEach((page) => mergedPdf.addPage(page));
                    } else {
                        logger.warn(`Archivo no encontrado: ${file1}`);
                        errors.push(`Archivo no encontrado: ${path.basename(file1)}`);
                        continue; // Si falta el primero, pasamos al siguiente par (o manejamos error)
                    }

                    // Procesar segundo archivo (si existe)
                    if (file2 && fs.existsSync(file2)) {
                        const pdfBytes2 = fs.readFileSync(file2);
                        const pdf2 = await PDFDocument.load(pdfBytes2);
                        const copiedPages2 = await mergedPdf.copyPages(pdf2, pdf2.getPageIndices());
                        copiedPages2.forEach((page) => mergedPdf.addPage(page));
                    }

                    // Generar nombre de archivo
                    const name1 = path.basename(file1, path.extname(file1));
                    const name2 = file2 ? path.basename(file2, path.extname(file2)) : 'FINAL';
                    const outputName = `MERGED_${name1}_${name2}.pdf`;
                    const outputPath = path.join(outputDir, outputName);

                    // Guardar archivo
                    const pdfBytes = await mergedPdf.save();
                    fs.writeFileSync(outputPath, pdfBytes);

                    generatedFiles.push({
                        path: outputPath,
                        name: outputName,
                        originalFiles: [file1, file2].filter(Boolean)
                    });

                    logger.info(`PDFs unidos correctamente: ${outputName}`);

                } catch (err) {
                    logger.error(`Error al unir par de archivos ${i}:`, err);
                    errors.push(`Error uniendo ${path.basename(file1)}: ${err.message}`);
                }
            }

            return {
                success: true,
                generatedFiles,
                errors
            };

        } catch (error) {
            logger.error('Error general en mergeInPairs:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new PdfMergerService();
