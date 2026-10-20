import test from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  get,
  record,
  validateDish,
  filterDishes,
} from "../src/domain.js";
const { categories, dishes } = seed();
test("seed: 3 categories, 5 dishes, valid relationships and prefixed nested fields", () => {
  assert.equal(categories.length, 3);
  assert.equal(dishes.length, 5);
  for (const d of dishes) {
    assert.equal(validateDish(d, categories, dishes), null);
    assert.ok(Object.keys(d).every((k) => k.startsWith("BIT240215_")));
    for (const image of get(d, "DishImage"))
      assert.ok(Object.keys(image).every((k) => k.startsWith("BIT240215_")));
  }
});
test("validates all required business rules", () => {
  const base = dishes[0],
    check = (values) =>
      validateDish({ ...base, ...record(values) }, categories, dishes);
  assert.equal(check({ Name: " " }), "required");
  assert.equal(check({ Price: 0 }), "badPrice");
  assert.equal(check({ Price: NaN }), "badPrice");
  assert.equal(check({ PreparationTime: -1 }), "badTime");
  assert.equal(check({ DishCategoryId: "missing" }), "badCategory");
  assert.equal(check({ Id: "another", Name: " GỎI CUỐN " }), "duplicate");
  assert.equal(check({ Id: "another", DishCategoryId: "drink" }), null);
  assert.equal(
    check({
      DishImage: [record({ ImageUrl: "file:///a", IsThumbnail: false })],
    }),
    "badUrl",
  );
  assert.equal(
    check({
      DishImage: [
        record({ ImageUrl: "https://a.com", IsThumbnail: true }),
        record({ ImageUrl: "https://b.com", IsThumbnail: true }),
      ],
    }),
    "badThumbnail",
  );
});
test("combines name, category, availability, price and sorting", () => {
  const f = {
    search: "",
    category: "",
    available: "all",
    min: "",
    max: "",
    sort: "asc",
  };
  assert.equal(
    filterDishes(dishes, {
      ...f,
      search: "gỎI",
      category: "starter",
      available: "yes",
      min: "30000",
      max: "40000",
    }).rows.length,
    1,
  );
  assert.ok(
    filterDishes(dishes, { ...f, available: "yes" }).rows.every((d) =>
      get(d, "IsAvailable"),
    ),
  );
  assert.equal(
    filterDishes(dishes, { ...f, min: "500", max: "100" }).error,
    "badRange",
  );
  assert.equal(filterDishes(dishes, { ...f, min: "abc" }).error, "badRange");
  assert.equal(filterDishes(dishes, { ...f, max: "Infinity" }).error, "badRange");
  assert.equal(filterDishes(dishes, { ...f, max: "1e9999" }).error, "badRange");
  assert.equal(
    get(filterDishes(dishes, { ...f, sort: "time" }).rows[0], "Name"),
    "Nước cam",
  );
});
