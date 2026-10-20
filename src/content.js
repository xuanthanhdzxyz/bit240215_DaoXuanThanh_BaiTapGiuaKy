import { get, normalize } from "./domain.js";

// Translate only exact demo text. Custom content is preserved until the user
// supplies both versions in the form. No local/remote data reset is required.
const examples = [
  ["Khai vị", "Starters", "Món nhẹ mở đầu", "Light dishes to start your meal."],
  ["Món chính", "Main courses", "Món ăn chính", "Main dishes for your meal."],
  ["Đồ uống", "Drinks", "Thức uống", "Refreshing beverages."],
  ["Gỏi cuốn", "Fresh spring rolls"],
  ["Salad rau củ", "Vegetable salad"],
  ["Cơm gà", "Chicken rice"],
  ["Bún bò", "Beef noodle soup"],
  ["Nước cam", "Orange juice"],
  [
    "Bánh mì thịt",
    "Vietnamese pork sandwich",
    "Món được tạo offline và tự đồng bộ lên MockAPI. Đào Xuân Thành - BIT240215.",
    "Created offline and automatically synced to MockAPI. Đào Xuân Thành - BIT240215.",
  ],
];
export function contentText(row, field, lang) {
  const explicit = get(row, field + (lang === "vi" ? "Vi" : "En"));
  if (typeof explicit === "string") return explicit;
  const value = get(row, field) || "";
  if (lang === "vi" || !value) return value;
  const sample = examples.find(
    ([name]) => normalize(name) === normalize(get(row, "Name")),
  );
  if (!sample) return value;
  if (field === "Name") return sample[1];
  if (field === "Description") {
    if (sample[2] && value === sample[2]) return sample[3];
    if (value === `${sample[0]} tươi ngon, chế biến trong ngày.`)
      return `${sample[1]}, freshly prepared each day.`;
  }
  return value;
}
