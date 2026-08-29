import { analyserIcal } from '../../netlify/functions/disponibilites.mjs';
// Echantillon au format Airbnb : CRLF, ligne pliee sur SUMMARY, DTEND exclusif.
const ics = [
"BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
"BEGIN:VEVENT","DTSTART;VALUE=DATE:20260214","DTEND;VALUE=DATE:20260221",
"SUMMARY:Reserved","UID:a1@airbnb.com","END:VEVENT",
"BEGIN:VEVENT","DTSTART;VALUE=DATE:20260307","DTEND;VALUE=DATE:20260314",
"SUMMARY:Airbnb (Not avail","\table)","UID:a2@airbnb.com","END:VEVENT",
"BEGIN:VEVENT","DTSTART:20260401T150000Z","DTEND:20260408T110000Z",
"SUMMARY:CLOSED - Not available","UID:b1@booking.com","END:VEVENT",
"BEGIN:VEVENT","DTSTART;VALUE=DATE:20260218","DTEND;VALUE=DATE:20260225",
"SUMMARY:Reserved","UID:c1","END:VEVENT",
"END:VCALENDAR"].join("\r\n");
const r = analyserIcal(ics, "Airbnb");
console.log("evenements analyses :", r.length);
r.forEach(p => console.log("  ", p.debut, "->", p.fin, "|", p.motif));
const ok = r.length === 4
  && r[0].debut === "2026-02-14" && r[0].fin === "2026-02-21"
  && r[1].motif === "bloque"                       // ligne pliee recollee
  && r[2].debut === "2026-04-01";                  // horodatage -> jour
console.log(ok ? "\nOK — pliage, VALUE=DATE et horodatages traites" : "\nECHEC");
process.exit(ok ? 0 : 1);
