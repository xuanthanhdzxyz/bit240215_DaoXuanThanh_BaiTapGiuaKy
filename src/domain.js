// Đào Xuân Thành - BIT240215. All persisted application fields are prefixed.
export const P = "BIT240215_";
export const key = (name) => P + name;
export const get = (row, name) => row?.[key(name)];
export const record = (values) =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [key(k), v]));
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
export const normalize = (value) =>
  String(value ?? "")
    .trim()
    .normalize("NFC")
    .toLocaleLowerCase("vi");
export const isUrl = (value) => {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol);
  } catch {
    return false;
  }
};
export function validateDish(dish, categories, dishes) {
  if (!String(get(dish, "Name") || "").trim()) return "required";
  if (!Number.isFinite(get(dish, "Price")) || get(dish, "Price") <= 0)
    return "badPrice";
  if (
    !Number.isFinite(get(dish, "PreparationTime")) ||
    get(dish, "PreparationTime") <= 0
  )
    return "badTime";
  if (!categories.some((c) => get(c, "Id") === get(dish, "DishCategoryId")))
    return "badCategory";
  if (
    dishes.some(
      (d) =>
        get(d, "Id") !== get(dish, "Id") &&
        get(d, "DishCategoryId") === get(dish, "DishCategoryId") &&
        normalize(get(d, "Name")) === normalize(get(dish, "Name")),
    )
  )
    return "duplicate";
  const images = get(dish, "DishImage") || [];
  if (images.some((i) => !isUrl(get(i, "ImageUrl")))) return "badUrl";
  if (images.filter((i) => get(i, "IsThumbnail")).length > 1)
    return "badThumbnail";
  return null;
}
export function filterDishes(dishes, f) {
  const min = f.min === "" ? 0 : Number(f.min),
    max = f.max === "" ? Infinity : Number(f.max);
  if (
    !Number.isFinite(min) ||
    min < 0 ||
    Number.isNaN(max) ||
    max < min ||
    max < 0
  )
    return { error: "badRange", rows: [] };
  let rows = dishes.filter(
    (d) =>
      normalize(get(d, "Name")).includes(normalize(f.search)) &&
      (!f.category || get(d, "DishCategoryId") === f.category) &&
      (f.available === "all" ||
        get(d, "IsAvailable") === (f.available === "yes")) &&
      get(d, "Price") >= min &&
      get(d, "Price") <= max,
  );
  rows.sort((a, b) =>
    f.sort === "time"
      ? get(a, "PreparationTime") - get(b, "PreparationTime")
      : f.sort === "desc"
        ? get(b, "Price") - get(a, "Price")
        : get(a, "Price") - get(b, "Price"),
  );
  return { rows };
}
export function seed() {
  const categories = [
    ["starter", "Khai vị", "Món nhẹ mở đầu"],
    ["main", "Món chính", "Món ăn chính"],
    ["drink", "Đồ uống", "Thức uống"],
  ].map(([Id, Name, Description]) => record({ Id, Name, Description }));
  const dishes = [
    ["d1", "Gỏi cuốn", 35000, 10, "starter", "photo-1546069901-ba9599a7e63c"],
    [
      "d2",
      "Salad rau củ",
      45000,
      12,
      "starter",
      "photo-1512621776951-a57141f2eefd",
    ],
    ["d3", "Cơm gà", 65000, 25, "main", "photo-1547592180-85f173990554"],
    ["d4", "Bún bò", 60000, 30, "main", "photo-1569718212165-3a8278d5f624"],
    ["d5", "Nước cam", 30000, 5, "drink", "photo-1613478223719-2ab802602423"],
  ].map(([Id, Name, Price, PreparationTime, DishCategoryId, photo], i) =>
    record({
      Id,
      Name,
      Price,
      PreparationTime,
      DishCategoryId,
      IsAvailable: i !== 3,
      Description: `${Name} tươi ngon, chế biến trong ngày.`,
      DishImage: [
        record({
          ImageUrl: `https://images.unsplash.com/${photo}?w=900&q=80`,
          IsThumbnail: true,
        }),
        record({
          ImageUrl:
            "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80",
          IsThumbnail: false,
        }),
      ],
    }),
  );
  return { categories, dishes };
}
