
async function loadEntryOptions() {
    try {
        const [vehicles, slots] = await Promise.all([
            api("/api/vehicles"),
            api("/api/slots")
        ]);

        const vehicleDropdown = $("entry_vehicle");
        const slotDropdown = $("entry_slot");

        vehicleDropdown.innerHTML =
            '<option value="">Select vehicle</option>' +
            vehicles.map(v =>
                `<option value="${v.vehicle_id}" data-type="${safe(v.vehicle_type)}">
                    ${safe(v.vehicle_number)} - ${safe(v.vehicle_type)}
                </option>`
            ).join("");

        function showSlots() {
            const type = vehicleDropdown.selectedOptions[0]?.dataset.type;

            const available = slots.filter(s =>
                s.status.trim().toLowerCase() === "available" &&
                s.vehicle_type.trim().toLowerCase() ===
                String(type || "").trim().toLowerCase()
            );

            slotDropdown.innerHTML =
                '<option value="">Select available slot</option>' +
                available.map(s =>
                    `<option value="${s.slot_id}">
                        ${safe(s.slot_number)} - ${safe(s.vehicle_type)}
                    </option>`
                ).join("");

            if (!available.length) {
                slotDropdown.innerHTML =
                    '<option value="">No available slots</option>';
            }
        }

        vehicleDropdown.onchange = showSlots;

        slotDropdown.innerHTML =
            '<option value="">Select vehicle first</option>';

    } catch (e) {
        toast(e.message);
        console.error(e);
    }
}
