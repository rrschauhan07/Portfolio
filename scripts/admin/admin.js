const tokenMeta = document.querySelector('meta[name="admin-token"]');
const token = tokenMeta?.getAttribute("content") ?? "";

const els = {
  form: document.getElementById("postForm"),
  postList: document.getElementById("postList"),
  postCount: document.getElementById("postCount"),
  newPost: document.getElementById("newPost"),
  modeLabel: document.getElementById("modeLabel"),
  editorTitle: document.getElementById("editorTitle"),
  saveState: document.getElementById("saveState"),
  title: document.getElementById("title"),
  slug: document.getElementById("slug"),
  slugHint: document.getElementById("slugHint"),
  description: document.getElementById("description"),
  date: document.getElementById("date"),
  category: document.getElementById("category"),
  manageCategories: document.getElementById("manageCategories"),
  categoryDialog: document.getElementById("categoryDialog"),
  closeCategoryDialog: document.getElementById("closeCategoryDialog"),
  categoryForm: document.getElementById("categoryForm"),
  newCategory: document.getElementById("newCategory"),
  addCategoryButton: document.getElementById("addCategory"),
  categoryMessage: document.getElementById("categoryMessage"),
  categoryList: document.getElementById("categoryList"),
  status: document.getElementById("status"),
  tags: document.getElementById("tags"),
  featured: document.getElementById("featured"),
  sample: document.getElementById("sample"),
  body: document.getElementById("body"),
  deletePost: document.getElementById("deletePost"),
  previewLink: document.getElementById("previewLink"),
  savePost: document.getElementById("savePost"),
  toast: document.getElementById("toast"),
};

const state = {
  posts: [],
  categories: [],
  current: null,
  dirty: false,
  saving: false,
  slugTouched: false,
  toastTimer: 0,
};

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set("X-Admin-Token", token);

  if (options.body) headers.set("Content-Type", "application/json");

  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // The endpoint may return an empty response on some failures.
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Session expired. Reload the dashboard to get a new token.");
    }
    throw new Error(data?.error || `Request failed (${response.status}).`);
  }

  return data;
}

function setDirty(dirty) {
  state.dirty = dirty;
  els.saveState.textContent = dirty ? "Unsaved changes" : "No unsaved changes";
  els.saveState.classList.toggle("is-dirty", dirty);
}

function confirmDiscard() {
  return !state.dirty || window.confirm("Discard unsaved changes?");
}

function showToast(message, isError = false) {
  window.clearTimeout(state.toastTimer);
  els.toast.textContent = message;
  els.toast.classList.toggle("is-error", isError);
  els.toast.classList.add("is-visible");

  state.toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, isError ? 6500 : 4200);
}

function sameCategory(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function categoryUsage(category) {
  return state.posts.filter(
    (post) => post.category && sameCategory(post.category, category),
  ).length;
}

function setCategoryMessage(message, isError = false) {
  els.categoryMessage.textContent = message;
  els.categoryMessage.classList.toggle("is-error", isError);
}

function renderCategoryManager() {
  els.categoryList.replaceChildren();

  if (!state.categories.length) {
    const empty = document.createElement("li");
    empty.className = "category-empty";
    empty.textContent = "No categories yet. Add one above.";
    els.categoryList.append(empty);
    return;
  }

  for (const category of state.categories) {
    const count = categoryUsage(category);
    const item = document.createElement("li");
    item.className = "category-item";

    const copy = document.createElement("div");
    copy.className = "category-item__copy";

    const name = document.createElement("span");
    name.className = "category-item__name";
    name.textContent = category;
    copy.append(name);

    const meta = document.createElement("span");
    meta.className = "category-item__meta";
    meta.textContent = count
      ? `${count} ${count === 1 ? "writeup" : "writeups"} · in use`
      : "Unused";
    if (count) meta.classList.add("is-used");
    copy.append(meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button button--danger button--small category-delete";
    remove.textContent = "Delete";
    remove.disabled = count > 0;
    remove.setAttribute("aria-label", `Delete category ${category}`);
    if (count) {
      remove.title = "Reassign or delete the writeups using this category first.";
    } else {
      remove.addEventListener("click", () => void removeCategory(category));
    }

    item.append(copy, remove);
    els.categoryList.append(item);
  }
}

function renderCategories(categories) {
  const next = Array.isArray(categories)
    ? categories.filter((category) => typeof category === "string" && category.trim())
    : [];
  const selected = els.category.value;
  state.categories = next;

  if (!next.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No categories yet";
    els.category.replaceChildren(option);
    els.category.value = "";
  } else {
    els.category.replaceChildren(
      ...next.map((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        return option;
      }),
    );

    const match = next.find((category) => category === selected)
      ?? next.find((category) => sameCategory(category, selected));
    els.category.value = match ?? next[0];
  }

  renderCategoryManager();
}

function openCategoryManager() {
  renderCategoryManager();
  setCategoryMessage("");
  if (!els.categoryDialog.open) els.categoryDialog.showModal();
  window.requestAnimationFrame(() => els.newCategory.focus());
}

async function createCategory(event) {
  event.preventDefault();
  if (els.addCategoryButton.disabled) return;

  const name = els.newCategory.value.trim().replace(/\s+/g, " ");
  if (!name) {
    setCategoryMessage("Enter a category name.", true);
    els.newCategory.focus();
    return;
  }

  const originalLabel = els.addCategoryButton.textContent;
  els.addCategoryButton.disabled = true;
  els.addCategoryButton.textContent = "Adding…";
  setCategoryMessage("");

  try {
    const data = await api("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    renderCategories(data.categories);
    els.category.value = data.category;
    setDirty(true);
    els.newCategory.value = "";
    setCategoryMessage(`“${data.category}” added and selected for this writeup.`);

    const addedItem = [...els.categoryList.children].find(
      (item) => item.querySelector(".category-item__name")?.textContent === data.category,
    );
    addedItem?.scrollIntoView({ block: "nearest" });

    els.newCategory.focus();
  } catch (error) {
    setCategoryMessage(error.message, true);
  } finally {
    els.addCategoryButton.disabled = false;
    els.addCategoryButton.textContent = originalLabel;
  }
}

async function removeCategory(category) {
  if (categoryUsage(category) > 0) return;

  const confirmed = window.confirm(
    `Delete the category “${category}”?\n\nThis removes it from the category list.`,
  );
  if (!confirmed) return;

  const selected = els.category.value;
  setCategoryMessage("");

  try {
    const data = await api("/api/categories", {
      method: "DELETE",
      body: JSON.stringify({ name: category }),
    });
    renderCategories(data.categories);
    if (els.category.value !== selected) setDirty(true);
    setCategoryMessage(`“${data.category}” deleted.`);
    els.newCategory.focus();
  } catch (error) {
    setCategoryMessage(error.message, true);
  }
}

function updateCount() {
  const count = state.posts.length;
  els.postCount.textContent = `${String(count).padStart(2, "0")} ${count === 1 ? "note" : "notes"}`;
}

function renderList() {
  els.postList.replaceChildren();

  if (!state.posts.length) {
    const empty = document.createElement("p");
    empty.className = "sidebar-status";
    empty.textContent = "No writeups yet. Start with a new post.";
    els.postList.append(empty);
    return;
  }

  for (const post of state.posts) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "post-item";
    button.setAttribute("aria-pressed", String(state.current?.slug === post.slug));

    const title = document.createElement("span");
    title.className = "post-item__title";
    title.textContent = post.title || "Untitled note";
    button.append(title);

    const meta = document.createElement("span");
    meta.className = "post-item__meta";

    const date = document.createElement("span");
    date.textContent = formatDate(post.date);
    meta.append(date);

    const category = document.createElement("span");
    category.textContent = post.category;
    meta.append(category);

    if (post.draft) {
      const badge = document.createElement("span");
      badge.className = "mini-tag mini-tag--draft";
      badge.textContent = "Draft";
      meta.append(badge);
    }

    if (post.sample) {
      const badge = document.createElement("span");
      badge.className = "mini-tag mini-tag--sample";
      badge.textContent = "Sample";
      meta.append(badge);
    }

    button.append(meta);
    button.addEventListener("click", () => {
      if (state.current?.slug === post.slug) return;
      void selectPost(post.slug);
    });
    els.postList.append(button);
  }
}

function fillForm(post) {
  state.current = post;
  state.slugTouched = Boolean(post);
  state.dirty = false;

  els.title.value = post?.title ?? "";
  els.slug.value = post?.slug ?? "";
  els.description.value = post?.description ?? "";
  els.date.value = post?.date ?? today();
  els.category.value = post?.category ?? state.categories[0] ?? "";
  els.status.value = post ? (post.draft ? "draft" : "published") : "draft";
  els.tags.value = (post?.tags ?? []).join(", ");
  els.featured.checked = Boolean(post?.featured);
  els.sample.checked = Boolean(post?.sample);
  els.body.value = post?.body ?? "";

  els.slug.readOnly = Boolean(post);
  els.slugHint.textContent = post
    ? "The URL stays stable after saving."
    : "Lowercase letters, numbers, and hyphens. The URL cannot be changed after saving.";

  els.deletePost.hidden = !post;
  els.previewLink.hidden = !post;

  if (post) {
    els.modeLabel.textContent = "Editing writeup";
    els.editorTitle.textContent = "Edit writeup";
    els.previewLink.href = `http://127.0.0.1:4321/writeups/${encodeURIComponent(post.slug)}/`;
  } else {
    els.modeLabel.textContent = "New writeup";
    els.editorTitle.textContent = "New writeup";
    els.previewLink.href = "http://127.0.0.1:4321/";
  }

  setDirty(false);
}

async function refreshPosts() {
  const data = await api("/api/posts");
  state.posts = data.posts;
  renderCategories(data.categories);
  updateCount();
  renderList();
}

async function selectPost(slug, { skipConfirm = false } = {}) {
  if (!skipConfirm && !confirmDiscard()) return;

  try {
    const data = await api(`/api/posts/${encodeURIComponent(slug)}`);
    fillForm(data.post);
    renderList();
  } catch (error) {
    showToast(error.message, true);
  }
}

function startNew({ skipConfirm = false } = {}) {
  if (!skipConfirm && !confirmDiscard()) return;

  fillForm(null);
  renderList();
  window.requestAnimationFrame(() => els.title.focus());
}

function collectForm() {
  return {
    title: els.title.value,
    slug: els.slug.value,
    description: els.description.value,
    date: els.date.value,
    category: els.category.value,
    status: els.status.value,
    tags: els.tags.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    featured: els.featured.checked,
    sample: els.sample.checked,
    body: els.body.value,
    draft: els.status.value === "draft",
  };
}

function validateForm(payload) {
  if (!payload.title.trim()) {
    els.title.focus();
    throw new Error("Add a title before saving.");
  }
  if (!payload.slug.trim() && !state.current) {
    els.slug.focus();
    throw new Error("Add a slug before saving.");
  }
  if (!payload.description.trim()) {
    els.description.focus();
    throw new Error("Add a description before saving.");
  }
  if (!payload.date) {
    els.date.focus();
    throw new Error("Choose a publication date.");
  }
  if (!payload.category) {
    els.category.focus();
    throw new Error("Choose a category.");
  }
  if (!payload.body.trim()) {
    els.body.focus();
    throw new Error("The note body is empty.");
  }
}

async function submitPost(event) {
  event.preventDefault();
  if (state.saving) return;

  const payload = collectForm();

  try {
    validateForm(payload);
  } catch (error) {
    showToast(error.message, true);
    return;
  }

  state.saving = true;
  els.savePost.disabled = true;
  const originalLabel = els.savePost.textContent;
  els.savePost.textContent = "Saving…";

  try {
    const editing = Boolean(state.current);
    const path = editing
      ? `/api/posts/${encodeURIComponent(state.current.slug)}`
      : "/api/posts";
    const data = await api(path, {
      method: editing ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    fillForm(data.post);
    await refreshPosts();
    showToast(
      data.post.draft
        ? "Draft saved locally. It will stay out of the production build."
        : "Saved locally. Commit and push to publish the update.",
    );
  } catch (error) {
    showToast(error.message, true);
  } finally {
    state.saving = false;
    els.savePost.disabled = false;
    els.savePost.textContent = originalLabel;
  }
}

async function removePost() {
  if (!state.current) return;

  const post = state.current;
  const confirmed = window.confirm(
    `Delete “${post.title}”?\n\nThis removes the source file and cannot be undone.`,
  );
  if (!confirmed) return;

  try {
    await api(`/api/posts/${encodeURIComponent(post.slug)}`, { method: "DELETE" });
    state.current = null;
    await refreshPosts();

    if (state.posts.length) {
      await selectPost(state.posts[0].slug, { skipConfirm: true });
    } else {
      startNew({ skipConfirm: true });
    }

    showToast("Writeup deleted.");
  } catch (error) {
    showToast(error.message, true);
  }
}

function markDirty(event) {
  if (event?.target === els.slug) state.slugTouched = true;

  if (
    event?.target === els.title &&
    !state.current &&
    !state.slugTouched
  ) {
    els.slug.value = slugify(els.title.value);
  }

  setDirty(true);
}

els.form.addEventListener("submit", submitPost);
els.form.addEventListener("input", markDirty);
els.form.addEventListener("change", markDirty);
els.newPost.addEventListener("click", () => startNew());
els.deletePost.addEventListener("click", removePost);
els.manageCategories.addEventListener("click", openCategoryManager);
els.closeCategoryDialog.addEventListener("click", () => els.categoryDialog.close());
els.categoryForm.addEventListener("submit", createCategory);

els.categoryDialog.addEventListener("click", (event) => {
  if (event.target === els.categoryDialog) els.categoryDialog.close();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (els.categoryDialog.open) return;
    if (!state.saving) els.form.requestSubmit();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
});

async function init() {
  try {
    const data = await api("/api/posts");
    state.posts = data.posts;
    renderCategories(data.categories);
    updateCount();
    renderList();

    if (state.posts.length) {
      await selectPost(state.posts[0].slug, { skipConfirm: true });
    } else {
      startNew({ skipConfirm: true });
    }
  } catch (error) {
    els.postList.replaceChildren();
    const message = document.createElement("p");
    message.className = "sidebar-status";
    message.textContent = "Could not load writeups.";
    els.postList.append(message);
    showToast(error.message, true);
  }
}

void init();
