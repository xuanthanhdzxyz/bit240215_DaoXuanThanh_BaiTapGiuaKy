import test from "node:test";
import assert from "node:assert/strict";
import { contentText } from "../src/content.js";
import { seed, record, get, filterDishes } from "../src/domain.js";
import { FoodRepository } from "../src/repository.js";
import { translate } from "../src/i18n.js";

test("existing demo records display names and descriptions in each selected language without mutating data", () => {
  const { dishes, categories } = seed(),
    before = JSON.stringify({ dishes, categories });
  assert.equal(contentText(dishes[0], "Name", "en"), "Fresh spring rolls");
  assert.equal(contentText(dishes[0], "Name", "vi"), "Gỏi cuốn");
  assert.match(contentText(dishes[0], "Description", "en"), /freshly prepared/);
  assert.equal(contentText(categories[0], "Name", "en"), "Starters");
  assert.equal(
    contentText(categories[0], "Description", "en"),
    "Light dishes to start your meal.",
  );
  assert.equal(JSON.stringify({ dishes, categories }), before);
});
test("custom translations override demo text; custom descriptions are never replaced with a guessed translation", () => {
  const dish = {
    ...seed().dishes[0],
    ...record({
      NameEn: "My spring rolls",
      NameVi: "Gỏi nhà làm",
      DescriptionEn: "No peanuts.",
      DescriptionVi: "Không đậu phộng.",
    }),
  };
  assert.equal(contentText(dish, "Name", "en"), "My spring rolls");
  assert.equal(contentText(dish, "Name", "vi"), "Gỏi nhà làm");
  assert.equal(contentText(dish, "Description", "vi"), "Không đậu phộng.");
  assert.equal(
    contentText(
      { ...seed().dishes[0], ...record({ Description: "Công thức riêng" }) },
      "Description",
      "en",
    ),
    "Công thức riêng",
  );
});
test("search follows the displayed language; UI footer and singular count follow the selected language", () => {
  const f = {
      search: "spring",
      category: "starter",
      available: "yes",
      min: "",
      max: "",
      sort: "asc",
    },
    rows = seed().dishes;
  assert.equal(
    filterDishes(rows, f, (d) => contentText(d, "Name", "en")).rows.length,
    1,
  );
  assert.equal(
    filterDishes(rows, f, (d) => contentText(d, "Name", "vi")).rows.length,
    0,
  );
  assert.equal(translate("vi")("course"), "Phát triển ứng dụng di động");
  assert.equal(translate("en")("totalSingular"), "dish");
});
test("bilingual names and descriptions survive offline storage and reopening the app", async () => {
  const values = new Map(),
    storage = {
      getItem: async (k) => values.get(k) || null,
      setItem: async (k, v) => values.set(k, v),
    };
  const repo = new FoodRepository(storage, async () => {
    throw Error("Network must not be used");
  });
  await repo.init();
  repo.setOnline(false);
  const dish = {
    ...repo.snapshot().dishes[0],
    ...record({
      NameVi: "Gỏi cuốn",
      NameEn: "Fresh rolls",
      DescriptionVi: "Mô tả mới",
      DescriptionEn: "Updated description",
    }),
  };
  await repo.saveDish(dish, true);
  const restarted = new FoodRepository(storage);
  await restarted.init();
  const saved = restarted
    .snapshot()
    .dishes.find((d) => get(d, "Id") === get(dish, "Id"));
  assert.equal(contentText(saved, "Name", "en"), "Fresh rolls");
  assert.equal(contentText(saved, "Description", "vi"), "Mô tả mới");
});
