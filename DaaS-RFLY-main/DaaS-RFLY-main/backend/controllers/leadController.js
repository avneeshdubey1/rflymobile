const fs = require('fs');
const path = require('path');
// Since node fetch is built-in for modern node, we will use it instead of axios.
// For earlier node versions, ensure node-fetch is installed, but Vite environments typically run Node 18+

const leadsFilePath = path.join(__dirname, '../data/leads.json');

// Helper to read and write leads
const getLeads = () => JSON.parse(fs.readFileSync(leadsFilePath, 'utf8'));
const saveLeads = (leads) => fs.writeFileSync(leadsFilePath, JSON.stringify(leads, null, 2));

exports.createLead = (req, res) => {
    try {
        const leads = getLeads();
        const newLead = {
            id: Date.now().toString(),
            status: 'pending',
            createdAt: new Date().toISOString(),
            ...req.body
        };
        leads.push(newLead);
        saveLeads(leads);

        res.status(201).json({ success: true, lead: newLead });
    } catch (error) {
        console.error("Error creating lead", error);
        res.status(500).json({ success: false, message: "Failed to create lead" });
    }
};

exports.getAllLeads = (req, res) => {
    try {
        res.status(200).json({ success: true, leads: getLeads() });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch leads" });
    }
};

exports.getPendingLeads = (req, res) => {
    try {
        const leads = getLeads();
        const pending = leads.filter(l => l.status === 'pending' || l.status === 'processed_waiting_dispatch');
        res.status(200).json({ success: true, leads: pending });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to fetch leads" });
    }
};

exports.processLead = async(req, res) => {
    try {
        const {
            id,
            employeeId,
            pilotName,
            mandal,
            district,
            fertilizerShop,
            expectedSpraying,
            expectedDate, // 14-07-26
            expectedTime
        } = req.body;

        const leads = getLeads();
        const leadIndex = leads.findIndex(l => l.id === id);

        if (leadIndex === -1) return res.status(404).json({ success: false, message: "Lead not found" });

        const lead = leads[leadIndex];

        // Prepare Google Form Data
        // Mapping based on extracted fields:
        // Employee ID -> entry.60313555
        // Pilot Name -> entry.592377768
        // Visiting village name -> entry.1911060756
        // Name of mandal -> entry.514818957
        // Name of District -> entry.408709326
        // Farmer Name -> entry.1588459040
        // Contact Number -> entry.1138515743
        // Crop name -> entry.98971288
        // Number of Acers -> entry.1346864291
        // Frequently used fertilizer shop name -> entry.1672651811
        // Expected Spraying Times / Arcers -> entry.883050351

        const formUrl = "https://docs.google.com/forms/d/e/1FAIpQLSfAvHEVaBXrxtmA8CFMq4tiHjxWTrYtnLNb23qbV5-PbkZhVg/formResponse";

        const formData = new URLSearchParams();
        formData.append("entry.60313555", employeeId || "N/A");
        formData.append("entry.592377768", pilotName || "N/A");
        formData.append("entry.1911060756", lead.village || "N/A");
        formData.append("entry.514818957", mandal || "N/A");
        formData.append("entry.408709326", district || "N/A");
        formData.append("entry.1588459040", lead.farmerName || "N/A");
        formData.append("entry.1138515743", lead.phone || "N/A");
        formData.append("entry.98971288", lead.cropType || "N/A");
        formData.append("entry.1346864291", lead.acres || "0");
        formData.append("entry.1672651811", fertilizerShop || "N/A");
        formData.append("entry.883050351", expectedSpraying || "N/A");

        // Submit to Google Form
        const googleRes = await fetch(formUrl, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // Mark local lead as processed (ready for dispatch)
        leads[leadIndex].status = 'processed_waiting_dispatch';
        leads[leadIndex].processedBy = employeeId; // Save for CRM logbook

        // 14-07-26
        leads[leadIndex].expectedDate = expectedDate;
        leads[leadIndex].expectedTime = expectedTime;
        saveLeads(leads);

        // Auto assign pilot 14-07-26
        try {
            await fetch(`http://localhost:5000/api/assignments/auto-assign/${id}`, {
                method: "POST"
            });
        } catch (err) {
            console.error("Auto assignment failed:", err);
        }

        res.status(200).json({
            success: true,
            message: "Lead submitted to Google Form & ready for dispatch"
        });

    } catch (error) {
        console.error("Error processing lead", error);
        res.status(500).json({
            success: false,
            message: "Failed to process lead"
        });
    }
};