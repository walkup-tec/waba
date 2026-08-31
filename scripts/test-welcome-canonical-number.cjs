const {
  pickCanonicalWhatsAppNumberFromExistsCheck,
  welcomeDestinationCandidates,
  toEvoSendNumberDigits,
} = require("../dist/mail/waba-whatsapp-exists-number.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(toEvoSendNumberDigits("41989006946") === "5541989006946", "nara local +55");
assert(toEvoSendNumberDigits("554189006946") === "554189006946", "already ddi");

const nara = pickCanonicalWhatsAppNumberFromExistsCheck([
  { jid: "41989006946@s.whatsapp.net", exists: false, number: "41989006946" },
  { jid: "554189006946@s.whatsapp.net", exists: true, number: "5541989006946" },
]);
assert(nara === "554189006946", `nara canonical, got ${nara}`);

const carlos = pickCanonicalWhatsAppNumberFromExistsCheck([
  { jid: "5518998000762@s.whatsapp.net", exists: true, number: "5518998000762" },
]);
assert(carlos === "5518998000762", `carlos canonical, got ${carlos}`);

assert(pickCanonicalWhatsAppNumberFromExistsCheck([{ exists: false }]) === "", "none exists");

const dest = welcomeDestinationCandidates("41989006946", "554189006946");
assert(dest[0] === "554189006946", "canonical first");
assert(dest.includes("5541989006946"), "typed variant kept as fallback");

console.log("ok");
