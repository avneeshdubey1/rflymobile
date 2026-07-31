import { jsPDF } from "jspdf";

const generatePDF = (lead) => {
    const pdf = new jsPDF();

    let y = 20;

    pdf.setFontSize(18);
    pdf.text("Drone Service Request", 20, y);

    y += 15;
    pdf.setFontSize(12);

    pdf.text("Status: Processing", 20, y);
    y += 10;

    pdf.text(`Farmer: ${lead.farmerName || ""}`, 20, y);
    y += 10;

    pdf.text(`Phone: ${lead.farmerPhone || ""}`, 20, y);
    y += 10;

    pdf.text(`Farm Size: ${lead.acreage || ""} Acres`, 20, y);
    y += 10;

    pdf.text(`Crop Type: ${lead.cropType || ""}`, 20, y);
    y += 10;

    pdf.text(`Village: ${lead.village || ""}`, 20, y);
    y += 10;

    pdf.text(`Soil Type: ${lead.soilType || ""}`, 20, y);
    y += 10;

    pdf.text(`Expected Date: ${lead.expectedDate || ""}`, 20, y);
    y += 10;

    pdf.text(`Expected Time: ${lead.expectedTime || ""}`, 20, y);

    pdf.save(`Request_${lead.farmerName || "Farmer"}.pdf`);
};

export default generatePDF;