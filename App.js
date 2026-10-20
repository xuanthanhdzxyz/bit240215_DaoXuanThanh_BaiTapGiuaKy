import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Switch,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AppState,
  BackHandler,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { FoodRepository } from "./src/repository";
import { get, record, uid, isUrl, filterDishes } from "./src/domain";
import { translate } from "./src/i18n";
import { router, Slot, usePathname } from "expo-router";
const repo = new FoodRepository(AsyncStorage);
const defaultFilters = {
  search: "",
  category: "",
  available: "all",
  min: "",
  max: "",
  sort: "asc",
};
function Button({
  children,
  onPress,
  kind = "primary",
  selected = false,
  disabled = false,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        kind === "primary"
          ? s.primary
          : kind === "danger"
            ? s.danger
            : s.secondary,
        selected && s.selected,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          kind !== "primary" && { color: "#243b35" },
          selected && { color: "#fff" },
          kind === "danger" && { color: "#aa3030" },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}
function Field({
  label,
  value,
  onChangeText,
  numeric = false,
  multiline = false,
  placeholder,
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#84928c"
        style={[
          s.input,
          multiline && { minHeight: 88, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}
function Photo({ url, t, large = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? (
    <Image
      accessibilityLabel={t("images")}
      source={{ uri: url }}
      style={large ? s.photoLarge : s.photo}
      onError={() => setFailed(true)}
    />
  ) : (
    <View style={[large ? s.photoLarge : s.photo, s.placeholder]}>
      <Text style={s.muted}>{t(url ? "loadError" : "noImages")}</Text>
    </View>
  );
}
export default function App() {
  const [data, setData] = useState(null),
    [loadError, setLoadError] = useState(false),
    [filters, setFilters] = useState(defaultFilters),
    [dialog, setDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [endpoint, setEndpoint] = useState("");
  const path = usePathname().split("/").filter(Boolean);
  const type = path[0] || "list",
    id = path[1];
  const page = {
    type,
    id,
    dish:
      type === "form" && id
        ? data?.dishes.find((d) => get(d, "Id") === id)
        : null,
  };
  const setPage = (next) =>
    router.push(
      "/" +
        (next.type === "list" ? "" : next.type) +
        (next.id ? "/" + next.id : next.dish ? "/" + get(next.dish, "Id") : ""),
    );
  const t = translate(data?.lang || "en");
  const load = async () => {
    setLoadError(false);
    try {
      await repo.init();
      setData(repo.snapshot());
      void repo.sync();
    } catch {
      setLoadError(true);
    }
  };
  useEffect(() => {
    const unsubscribe = repo.subscribe(() => setData(repo.snapshot()));
    void load();
    const network = NetInfo.addEventListener((state) =>
      repo.setOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      ),
    );
    const timer = setInterval(() => void repo.sync(), 20000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") void repo.sync();
    });
    return () => {
      unsubscribe();
      network();
      clearInterval(timer);
      app.remove();
    };
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page.type !== "list") {
        setPage({ type: "list" });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [page.type]);
  const run = async (action) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      const known = [
        "required",
        "badPrice",
        "badTime",
        "badCategory",
        "duplicate",
        "badUrl",
        "badThumbnail",
        "inUse",
        "missing",
        "badEndpoint",
      ];
      setDialog({
        message: known.includes(e.message) ? e.message : "storageError",
      });
    } finally {
      setBusy(false);
    }
  };
  const confirm = (type, id) =>
    setDialog({
      message: "confirmBody",
      confirm: () =>
        run(async () => {
          await repo.remove(type, id);
          if (type === "dishes") setPage({ type: "list" });
        }),
    });
  if (!data)
    return (
      <View style={s.loading}>
        <StatusBar style="dark" />
        {loadError ? (
          <>
            <Text style={s.error}>{t("storageError")}</Text>
            <Button onPress={load}>{t("retry")}</Button>
          </>
        ) : (
          <>
            <ActivityIndicator color="#14634c" />
            <Text>{t("loading")}</Text>
          </>
        )}
      </View>
    );
  const categoryName = (id) =>
    get(
      data.categories.find((c) => get(c, "Id") === id),
      "Name",
    ) || t("missing");
  const money = (value) =>
    new Intl.NumberFormat(data.lang === "vi" ? "vi-VN" : "en-US").format(
      value,
    ) + " ₫";
  const current = data.dishes.find((d) => get(d, "Id") === page.id),
    filtered = filterDishes(data.dishes, filters);
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>BIT240215_FoodManager</Text>
          <Text style={s.title}>{t("title")}</Text>
          <Text style={s.muted}>{t("about")}</Text>
        </View>
        <Button
          kind="secondary"
          onPress={() =>
            run(() => repo.language(data.lang === "en" ? "vi" : "en"))
          }
        >
          {data.lang === "en" ? "Tiếng Việt" : "English"}
        </Button>
      </View>
      <View style={s.status}>
        <View
          style={[
            s.dot,
            {
              backgroundColor: ["synced", "local"].includes(data.status)
                ? "#239d6a"
                : data.status === "syncing"
                  ? "#d79c2f"
                  : "#c0543c",
            },
          ]}
        />
        <Text style={s.statusText}>
          {t(data.status)} · {t("pending")}: {data.pending}
        </Text>
      </View>
      <View style={s.nav}>
        {["list", "categories", "settings"].map((type) => (
          <Button
            key={type}
            kind="secondary"
            selected={page.type === type}
            onPress={() => {
              if (type === "settings") setEndpoint(data.endpoint);
              setPage({ type });
            }}
          >
            {t(type)}
          </Button>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {page.type === "list" && (
          <>
            <View style={s.rowBetween}>
              <View>
                <Text style={s.section}>{t("list")}</Text>
                <Text style={s.muted}>
                  {data.dishes.length} {t("total")}
                </Text>
              </View>
              <Button onPress={() => setPage({ type: "form" })}>
                ＋ {t("add")}
              </Button>
            </View>
            <View style={s.panel}>
              <TextInput
                accessibilityLabel={t("search")}
                placeholder={t("search")}
                placeholderTextColor="#84928c"
                style={s.input}
                value={filters.search}
                onChangeText={(v) => setFilter("search", v)}
              />
              <Text style={s.label}>{t("category")}</Text>
              <View style={s.wrap}>
                <Button
                  kind="secondary"
                  selected={!filters.category}
                  onPress={() => setFilter("category", "")}
                >
                  {t("all")}
                </Button>
                {data.categories.map((c) => (
                  <Button
                    key={get(c, "Id")}
                    kind="secondary"
                    selected={filters.category === get(c, "Id")}
                    onPress={() => setFilter("category", get(c, "Id"))}
                  >
                    {get(c, "Name")}
                  </Button>
                ))}
              </View>
              <View style={s.wrap}>
                {[
                  ["all", "all"],
                  ["yes", "available"],
                  ["no", "unavailable"],
                ].map(([v, k]) => (
                  <Button
                    key={v}
                    kind="secondary"
                    selected={filters.available === v}
                    onPress={() => setFilter("available", v)}
                  >
                    {t(k)}
                  </Button>
                ))}
              </View>
              <View style={s.row}>
                <View style={s.flex}>
                  <Field
                    label={t("min")}
                    value={filters.min}
                    onChangeText={(v) => setFilter("min", v)}
                    numeric
                  />
                </View>
                <View style={s.flex}>
                  <Field
                    label={t("max")}
                    value={filters.max}
                    onChangeText={(v) => setFilter("max", v)}
                    numeric
                  />
                </View>
              </View>
              <View style={s.wrap}>
                {[
                  ["asc", "asc"],
                  ["desc", "desc"],
                  ["time", "timeSort"],
                ].map(([v, k]) => (
                  <Button
                    key={v}
                    kind="secondary"
                    selected={filters.sort === v}
                    onPress={() => setFilter("sort", v)}
                  >
                    {t(k)}
                  </Button>
                ))}
                <Button
                  kind="secondary"
                  onPress={() => setFilters(defaultFilters)}
                >
                  {t("resetFilters")}
                </Button>
              </View>
              {filtered.error && (
                <Text accessibilityRole="alert" style={s.error}>
                  {t(filtered.error)}
                </Text>
              )}
            </View>
            {!filtered.rows.length && !filtered.error && (
              <Text style={s.empty}>{t("empty")}</Text>
            )}
            {filtered.rows.map((d) => {
              const imgs = get(d, "DishImage") || [],
                cover = imgs.find((i) => get(i, "IsThumbnail")) || imgs[0];
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={get(d, "Name")}
                  key={get(d, "Id")}
                  onPress={() => setPage({ type: "detail", id: get(d, "Id") })}
                  style={s.card}
                >
                  <Photo url={get(cover, "ImageUrl")} t={t} />
                  <View style={s.cardBody}>
                    <Text style={s.cardTitle}>{get(d, "Name")}</Text>
                    <Text style={s.muted}>
                      {categoryName(get(d, "DishCategoryId"))}
                    </Text>
                    <Text style={s.price}>{money(get(d, "Price"))}</Text>
                    <View style={s.wrap}>
                      <Text style={s.badge}>
                        {get(d, "PreparationTime")} {t("minutes")} ·{" "}
                        {t(
                          get(d, "PreparationTime") <= 15 ? "quick" : "regular",
                        )}
                      </Text>
                      <Text
                        style={[
                          s.badge,
                          !get(d, "IsAvailable") && s.unavailable,
                        ]}
                      >
                        {t(get(d, "IsAvailable") ? "available" : "unavailable")}
                      </Text>
                    </View>
                  </View>
                  <Text style={s.arrow}>›</Text>
                </Pressable>
              );
            })}
          </>
        )}
        {page.type === "detail" && (
          <>
            <Button kind="secondary" onPress={() => setPage({ type: "list" })}>
              ← {t("back")}
            </Button>
            {current ? (
              <>
                <Text style={s.section}>{get(current, "Name")}</Text>
                <Text style={s.muted}>
                  {categoryName(get(current, "DishCategoryId"))}
                </Text>
                <Text style={s.detailPrice}>
                  {money(get(current, "Price"))}
                </Text>
                <View style={s.wrap}>
                  <Text style={s.badge}>
                    {get(current, "PreparationTime")} {t("minutes")} ·{" "}
                    {t(
                      get(current, "PreparationTime") <= 15
                        ? "quick"
                        : "regular",
                    )}
                  </Text>
                  <Text style={s.badge}>
                    {t(
                      get(current, "IsAvailable") ? "available" : "unavailable",
                    )}
                  </Text>
                </View>
                <Text style={s.body}>{get(current, "Description")}</Text>
                <Text style={s.section}>{t("images")}</Text>
                {!(get(current, "DishImage") || []).length && (
                  <Photo t={t} large />
                )}
                {(get(current, "DishImage") || []).map((img, i) => (
                  <View key={i} style={s.panel}>
                    <Photo large url={get(img, "ImageUrl")} t={t} />
                    <Button
                      kind="secondary"
                      selected={get(img, "IsThumbnail")}
                      disabled={busy}
                      onPress={() =>
                        run(() =>
                          repo.saveDish(
                            {
                              ...current,
                              ...record({
                                DishImage: get(current, "DishImage").map(
                                  (v, j) => ({
                                    ...v,
                                    ...record({ IsThumbnail: i === j }),
                                  }),
                                ),
                              }),
                            },
                            true,
                          ),
                        )
                      }
                    >
                      {t(get(img, "IsThumbnail") ? "thumbnail" : "setCover")}
                    </Button>
                  </View>
                ))}
                <View style={s.wrap}>
                  <Button
                    onPress={() => setPage({ type: "form", dish: current })}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    kind="danger"
                    onPress={() => confirm("dishes", page.id)}
                  >
                    {t("remove")}
                  </Button>
                </View>
              </>
            ) : (
              <Text style={s.error}>{t("missing")}</Text>
            )}
          </>
        )}
        {page.type === "form" && id && !page.dish && (
          <Text style={s.error}>{t("missing")}</Text>
        )}
        {page.type === "form" && (!id || page.dish) && (
          <DishForm
            key={get(page.dish, "Id") || "new"}
            dish={page.dish}
            data={data}
            t={t}
            busy={busy}
            cancel={() =>
              setPage(
                page.dish
                  ? { type: "detail", id: get(page.dish, "Id") }
                  : { type: "list" },
              )
            }
            save={(dish) =>
              run(async () => {
                await repo.saveDish(dish, !!page.dish);
                setPage({ type: "detail", id: get(dish, "Id") });
              })
            }
            error={(message) => setDialog({ message })}
          />
        )}
        {page.type === "categories" && (
          <Categories
            data={data}
            t={t}
            busy={busy}
            save={(c, editing) => run(() => repo.saveCategory(c, editing))}
            remove={(id) => confirm("categories", id)}
          />
        )}
        {page.type === "settings" && (
          <View style={s.panel}>
            <Text style={s.section}>{t("settings")}</Text>
            <Text style={s.body}>{t("endpointHelp")}</Text>
            <Field
              label={t("endpoint")}
              value={endpoint}
              onChangeText={setEndpoint}
              placeholder="https://PROJECT.mockapi.io/api/v1"
            />
            <Button
              disabled={busy}
              onPress={() =>
                run(async () => {
                  await repo.endpoint(endpoint);
                  setDialog({ message: "connectionSaved" });
                })
              }
            >
              {t("save")}
            </Button>
            <Text selectable style={s.muted}>
              BIT240215_DishCategory{"\n"}BIT240215_Dish
            </Text>
          </View>
        )}
        <Text style={s.footer}>
          Đào Xuân Thành · BIT240215{"\n"}Mobile Development · Food Manager
        </Text>
      </ScrollView>
      <Slot />
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={() => setDialog(null)}
      >
        <View style={s.overlay}>
          <View style={s.dialog}>
            <Text style={s.section}>
              {t(dialog?.confirm ? "confirm" : "title")}
            </Text>
            <Text style={s.body}>{t(dialog?.message)}</Text>
            <View style={s.wrap}>
              {dialog?.confirm && (
                <Button kind="secondary" onPress={() => setDialog(null)}>
                  {t("cancel")}
                </Button>
              )}
              <Button
                kind={dialog?.confirm ? "danger" : "primary"}
                onPress={() => {
                  const action = dialog?.confirm;
                  setDialog(null);
                  if (action) action();
                }}
              >
                {t(dialog?.confirm ? "remove" : "back")}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
function DishForm({ dish, data, t, save, cancel, busy, error }) {
  const [name, setName] = useState(get(dish, "Name") || ""),
    [price, setPrice] = useState(dish ? String(get(dish, "Price")) : ""),
    [time, setTime] = useState(
      dish ? String(get(dish, "PreparationTime")) : "",
    ),
    [description, setDescription] = useState(get(dish, "Description") || ""),
    [category, setCategory] = useState(
      get(dish, "DishCategoryId") || get(data.categories[0], "Id") || "",
    ),
    [available, setAvailable] = useState(
      dish ? get(dish, "IsAvailable") : true,
    ),
    [images, setImages] = useState(get(dish, "DishImage") || []),
    [url, setUrl] = useState("");
  const cover = (i) =>
    setImages((old) =>
      old.map((img, j) => ({ ...img, ...record({ IsThumbnail: i === j }) })),
    );
  const removeImage = (i) =>
    setImages((old) => {
      const next = old.filter((_, j) => i !== j);
      return next.length && !next.some((v) => get(v, "IsThumbnail"))
        ? next.map((v, j) => ({ ...v, ...record({ IsThumbnail: j === 0 }) }))
        : next;
    });
  const submit = () => {
    if (url.trim()) {
      error("unaddedImage");
      return;
    }
    save(
      record({
        Id: get(dish, "Id") || uid(),
        Name: name.trim(),
        Price: Number(price),
        PreparationTime: Number(time),
        Description: description.trim(),
        DishCategoryId: category,
        IsAvailable: available,
        DishImage: images,
      }),
    );
  };
  return (
    <View style={s.panel}>
      <Text style={s.section}>{t(dish ? "edit" : "add")}</Text>
      <Field label={t("name")} value={name} onChangeText={setName} />
      <Field label={t("price")} value={price} onChangeText={setPrice} numeric />
      <Field label={t("time")} value={time} onChangeText={setTime} numeric />
      <Text style={s.label}>{t("category")}</Text>
      <View style={s.wrap}>
        {data.categories.map((c) => (
          <Button
            key={get(c, "Id")}
            kind="secondary"
            selected={category === get(c, "Id")}
            onPress={() => setCategory(get(c, "Id"))}
          >
            {get(c, "Name")}
          </Button>
        ))}
      </View>
      {!data.categories.length && (
        <Text style={s.error}>{t("noCategories")}</Text>
      )}
      <View style={s.rowBetween}>
        <Text style={s.label}>{t("available")}</Text>
        <Switch
          accessibilityLabel={t("available")}
          value={available}
          onValueChange={setAvailable}
          trackColor={{ true: "#3a9375" }}
        />
      </View>
      <Field
        label={t("description")}
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <Text style={s.section}>{t("images")}</Text>
      <Field
        label={t("imageUrl")}
        value={url}
        onChangeText={setUrl}
        placeholder="https://…"
      />
      <Button
        kind="secondary"
        onPress={() => {
          if (!isUrl(url.trim())) {
            error("badUrl");
            return;
          }
          setImages((old) => [
            ...old,
            record({ ImageUrl: url.trim(), IsThumbnail: old.length === 0 }),
          ]);
          setUrl("");
        }}
      >
        {t("addImage")}
      </Button>
      {!images.length && <Text style={s.muted}>{t("noImages")}</Text>}
      {images.map((img, i) => (
        <View key={i} style={s.imageEditor}>
          <Photo url={get(img, "ImageUrl")} t={t} />
          <View style={s.flex}>
            <Text numberOfLines={2} style={s.muted}>
              {get(img, "ImageUrl")}
            </Text>
            <View style={s.wrap}>
              <Button
                kind="secondary"
                selected={get(img, "IsThumbnail")}
                onPress={() => cover(i)}
              >
                {t(get(img, "IsThumbnail") ? "thumbnail" : "setCover")}
              </Button>
              <Button kind="danger" onPress={() => removeImage(i)}>
                {t("remove")}
              </Button>
            </View>
          </View>
        </View>
      ))}
      <View style={s.wrap}>
        <Button disabled={busy} onPress={submit}>
          {t("save")}
        </Button>
        <Button kind="secondary" onPress={cancel}>
          {t("cancel")}
        </Button>
      </View>
    </View>
  );
}
function Categories({ data, t, busy, save, remove }) {
  const [editing, setEditing] = useState(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState("");
  return (
    <>
      <View style={s.panel}>
        <Text style={s.section}>{t(editing ? "edit" : "addCategory")}</Text>
        <Field label={t("name")} value={name} onChangeText={setName} />
        <Field
          label={t("description")}
          value={description}
          onChangeText={setDescription}
          multiline
        />
        <View style={s.wrap}>
          <Button
            disabled={busy}
            onPress={() =>
              save(
                record({
                  Id: editing || uid(),
                  Name: name,
                  Description: description,
                }),
                !!editing,
              )
            }
          >
            {t("save")}
          </Button>
          <Button
            kind="secondary"
            onPress={() => {
              setEditing(null);
              setName("");
              setDescription("");
            }}
          >
            {t("cancel")}
          </Button>
        </View>
      </View>
      {data.categories.map((c) => (
        <View key={get(c, "Id")} style={s.panel}>
          <Text style={s.cardTitle}>{get(c, "Name")}</Text>
          <Text style={s.body}>{get(c, "Description")}</Text>
          <Text style={s.muted}>
            {
              data.dishes.filter(
                (d) => get(d, "DishCategoryId") === get(c, "Id"),
              ).length
            }{" "}
            {t("total")}
          </Text>
          <View style={s.wrap}>
            <Button
              kind="secondary"
              onPress={() => {
                setEditing(get(c, "Id"));
                setName(get(c, "Name"));
                setDescription(get(c, "Description"));
              }}
            >
              {t("edit")}
            </Button>
            <Button kind="danger" onPress={() => remove(get(c, "Id"))}>
              {t("remove")}
            </Button>
          </View>
        </View>
      ))}
    </>
  );
}
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f4f5ef",
    paddingTop:
      Platform.OS === "android" ? 32 : Platform.OS === "ios" ? 52 : 16,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 20,
    backgroundColor: "#f4f5ef",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  eyebrow: {
    color: "#197155",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#183e31",
    marginVertical: 4,
  },
  muted: { fontSize: 12, color: "#6b7b73", lineHeight: 19 },
  status: {
    marginHorizontal: 20,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#e5eee4",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  statusText: { fontSize: 11, color: "#315b47", flex: 1, lineHeight: 17 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  nav: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
    width: "100%",
    maxWidth: 850,
    alignSelf: "center",
  },
  button: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
  },
  primary: { backgroundColor: "#17664c" },
  secondary: {
    backgroundColor: "#edf1e9",
    borderWidth: 1,
    borderColor: "#dce4d9",
  },
  danger: {
    backgroundColor: "#fcebea",
    borderWidth: 1,
    borderColor: "#f0cdca",
  },
  selected: { backgroundColor: "#285c47", borderColor: "#285c47" },
  buttonText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  row: { flexDirection: "row", gap: 12 },
  flex: { flex: 1 },
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  panel: {
    padding: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e8dd",
    borderRadius: 18,
    gap: 12,
  },
  section: {
    fontSize: 21,
    color: "#203e30",
    fontWeight: "800",
    marginVertical: 3,
  },
  label: { fontSize: 12, color: "#445b4d", fontWeight: "700", marginBottom: 6 },
  field: { flexGrow: 1 },
  input: {
    borderWidth: 1,
    borderColor: "#d6dfd3",
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: "#203b2e",
    backgroundColor: "#fafcf8",
    minHeight: 45,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e3e8db",
  },
  photo: {
    width: 88,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#e9ede3",
  },
  photoLarge: {
    width: "100%",
    height: 230,
    borderRadius: 14,
    backgroundColor: "#e9ede3",
  },
  placeholder: { alignItems: "center", justifyContent: "center", padding: 8 },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#243d2e" },
  price: { fontSize: 17, color: "#14634c", fontWeight: "800" },
  detailPrice: { fontSize: 30, color: "#14634c", fontWeight: "800" },
  badge: {
    fontSize: 10,
    color: "#4a674e",
    backgroundColor: "#edf3e6",
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 7,
    overflow: "hidden",
  },
  unavailable: { color: "#976542", backgroundColor: "#f6ede1" },
  arrow: { fontSize: 28, color: "#698272" },
  body: { fontSize: 14, lineHeight: 23, color: "#475e50" },
  error: { color: "#b33c31", fontSize: 13, lineHeight: 21 },
  empty: { padding: 36, textAlign: "center", color: "#687b69" },
  footer: {
    fontSize: 10,
    textAlign: "center",
    lineHeight: 18,
    color: "#7f8d7b",
    marginTop: 12,
  },
  imageEditor: { flexDirection: "row", gap: 12, paddingVertical: 8 },
  overlay: {
    flex: 1,
    backgroundColor: "#14271c88",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    gap: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
  },
});
