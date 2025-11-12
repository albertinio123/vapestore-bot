import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const productsPath = path.join(process.cwd(), "products.json");
    const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));

    const { data } = req.body;

    // Jei nėra callback data – rodom kategorijas
    if (!data) {
      const categories = Object.keys(products);
      const keyboard = categories.map((category) => [{ text: category, callback_data: category }]);
      return res.status(200).json({
        text: "Pasirink kategoriją / Choose category:",
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    // Jei paspausta kategorija – rodom subkategorijas (angliškas)
    if (data && !data.includes("|")) {
      const subcategories = Object.keys(products[data]);
      const keyboard = subcategories.map((sub) => [
        { text: sub, callback_data: `${data}|${sub}` },
      ]);
      return res.status(200).json({
        text: `Pasirink subkategoriją / Choose subcategory (${data}):`,
        reply_markup: { inline_keyboard: keyboard },
      });
    }

    // Jei paspausta subkategorija – rodom prekes
    const [category, subcategory] = data.split("|");
    const items = products[category]?.[subcategory] || [];

    if (items.length === 0) {
      return res.status(200).json({
        text: "Šioje subkategorijoje prekių nėra / No products found.",
      });
    }

    const messages = items.map(
      (item) =>
        `🛍 *${item.title}*\n${item.description}\n\n[Nuotrauka](${item.image})`
    );

    return res.status(200).json({
      text: messages.join("\n\n"),
      parse_mode: "Markdown",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
