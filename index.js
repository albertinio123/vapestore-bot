import fs from "fs";

const data = JSON.parse(fs.readFileSync("products.json", "utf8"));

console.log("Sveiki! Čia VAPE skysčių katalogas 💨");
console.log("Pasirinkite brendą iš šių variantų:\n");

const brands = Object.keys(data["E-Liquids / Skysčiai"]);

brands.forEach((brand, index) => {
  console.log(`${index + 1}. ${brand}`);
});

const readline = await import("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function klauskBrendo() {
  rl.question("\nĮveskite brendo numerį: ", (ats) => {
    const pasirinktas = parseInt(ats) - 1;
    if (isNaN(pasirinktas) || pasirinktas < 0 || pasirinktas >= brands.length) {
      console.log("❌ Neteisingas pasirinkimas. Bandykite dar kartą.");
      klauskBrendo();
      return;
    }

    const brandName = brands[pasirinktas];
    const flavors = data["E-Liquids / Skysčiai"][brandName];
    console.log(`\nPasirinkote: ${brandName}`);
    console.log("Galimi skoniai:\n");

    flavors.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
    });

    klauskSkonio(brandName, flavors);
  });
}

function klauskSkonio(brand, flavors) {
  rl.question("\nĮveskite skonio numerį: ", (ats) => {
    const pasirinktas = parseInt(ats) - 1;
    if (isNaN(pasirinktas) || pasirinktas < 0 || pasirinktas >= flavors.length) {
      console.log("❌ Neteisingas pasirinkimas. Bandykite dar kartą.");
      klauskSkonio(brand, flavors);
      return;
    }

    const preke = flavors[pasirinktas];
    console.log(`\n🧴 ${brand} – ${preke.title}`);
    console.log(`Aprašymas: ${preke.description}`);
    console.log(`Kaina: ${preke.price}`);
    console.log("\nAčiū, kad naudojatės VapeStore katalogu! 💨");

    rl.close();
  });
}

klauskBrendo();
