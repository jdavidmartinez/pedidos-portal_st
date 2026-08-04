"use client";

/* eslint-disable @next/next/no-img-element -- Las vistas previas aceptan URLs administradas que no pueden limitarse a un host fijo. */

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import AdminCampaignsClient from "./admin-campaigns-client";
import AdminBlobCleanup from "./admin-blob-cleanup";
import AdminImageUploader from "./admin-image-uploader";

interface Product {
  id: string;
  slug: string;
  categorySlug: string;
  name: string;
  description: string;
  individualPrice: number;
  comboPrice: number | null;
  imageUrl: string;
  availableQuantity: number | null;
  active: boolean;
  sortOrder: number;
}

interface Category {
  slug: string;
  name: string;
  active: boolean;
  sortOrder: number;
  products: Product[];
}

interface Props {
  username: string;
}

const EMPTY_NEW_PRODUCT = {
  categorySlug: "",
  name: "",
  description: "",
  individualPrice: 0,
  comboPrice: null as number | null,
  imageUrl: "",
  availableQuantity: null as number | null,
  active: true,
  sortOrder: 0,
};

const formatCOP = (value: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);

function productPayload(product: Product) {
  return {
    categorySlug: product.categorySlug,
    name: product.name,
    description: product.description,
    individualPrice: Number(product.individualPrice),
    comboPrice: product.comboPrice === null || product.comboPrice === undefined
      ? null
      : Number(product.comboPrice),
    imageUrl: product.imageUrl,
    availableQuantity: product.availableQuantity,
    active: product.active,
    sortOrder: Number(product.sortOrder),
  };
}

export default function AdminMenuClient({ username }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newProduct, setNewProduct] = useState(EMPTY_NEW_PRODUCT);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentCategory = useMemo(
    () => categories.find((category) => category.slug === selectedCategory),
    [categories, selectedCategory]
  );

  async function loadCatalog() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/menu", { cache: "no-store" });
      const payload = await response.json() as { categories?: Category[]; error?: string };

      if (response.status === 401) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }

      if (!response.ok || !payload.categories) {
        throw new Error(payload.error || "No fue posible cargar el catálogo.");
      }

      setCategories(payload.categories);
      setSelectedCategory((current) => current || payload.categories![0]?.slug || "");
      setNewProduct((current) => ({
        ...current,
        categorySlug: current.categorySlug || payload.categories![0]?.slug || "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el catálogo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadCatalog(), 0);
    return () => window.clearTimeout(initialLoad);
  }, []);

  function updateProduct(id: string, field: keyof Product, value: string | number | boolean | null) {
    setCategories((current) => current.map((category) => ({
      ...category,
      products: category.products.map((product) =>
        product.id === id ? { ...product, [field]: value } : product
      ),
    })));
  }

  async function saveProduct(product: Product) {
    setSavingId(product.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/menu/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(productPayload(product)),
      });
      const payload = await response.json() as { product?: Product; error?: string };

      if (response.status === 401) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }
      if (!response.ok || !payload.product) {
        throw new Error(payload.error || "No fue posible guardar el producto.");
      }

      setCategories((current) => current.map((category) => ({
        ...category,
        products: category.products.map((item) =>
          item.id === product.id ? payload.product! : item
        ),
      })));
      setNotice(`Producto actualizado: ${payload.product.name}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No fue posible guardar el producto.");
    } finally {
      setSavingId(null);
    }
  }

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newProduct,
          individualPrice: Number(newProduct.individualPrice),
          comboPrice: newProduct.comboPrice === null ? null : Number(newProduct.comboPrice),
          availableQuantity: newProduct.availableQuantity === null ? null : Number(newProduct.availableQuantity),
          sortOrder: Number(newProduct.sortOrder),
        }),
      });
      const payload = await response.json() as { product?: Product; error?: string };

      if (response.status === 401) {
        window.location.replace("/cocina/login?next=/admin");
        return;
      }
      if (!response.ok || !payload.product) {
        throw new Error(payload.error || "No fue posible crear el producto.");
      }

      setCategories((current) => current.map((category) => category.slug === payload.product!.categorySlug
        ? { ...category, products: [...category.products, payload.product!] }
        : category
      ));
      setSelectedCategory(payload.product.categorySlug);
      setNewProduct({ ...EMPTY_NEW_PRODUCT, categorySlug: payload.product.categorySlug });
      setShowNewProduct(false);
      setNotice(`Producto creado: ${payload.product.name}.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No fue posible crear el producto.");
    } finally {
      setCreating(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/cocina/login");
  }

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white selection:bg-[#B03336]">
      <header className="border-b border-[#B03336]/70 bg-black px-4 py-4">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Image
              src="/images/Logo-Portal.png"
              width={64}
              height={64}
              alt="Logo de Portal ST"
              loading="eager"
              className="h-16 w-16 rounded-full object-cover"
            />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.35em] text-[#facc15]">Portal ST</p>
              <h1 className="mt-1 text-2xl font-black uppercase sm:text-3xl">Administrar menú</h1>
              <p className="mt-1 text-xs text-white/55">Sesión activa: {username}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/usuarios" className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:border-[#facc15] hover:text-[#facc15]">Usuarios</a>
            <a href="/cuenta" className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:border-[#facc15] hover:text-[#facc15]">Mi cuenta</a>
            <a href="/cocina" className="rounded-lg border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:border-[#facc15] hover:text-[#facc15]">Volver a cocina</a>
            <button type="button" onClick={() => void logout()} className="rounded-lg border border-red-300/40 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-red-200 transition hover:bg-red-400/10">Cerrar sesión</button>
          </div>
        </div>
      </header>

      <AdminCampaignsClient />
      <AdminBlobCleanup />

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-white/10 bg-[#171717] p-3 lg:sticky lg:top-4">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Categorías</p>
          <div className="grid gap-2">
            {categories.map((category) => (
              <button
                key={category.slug}
                type="button"
                onClick={() => setSelectedCategory(category.slug)}
                className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left text-xs font-black uppercase tracking-wider transition ${selectedCategory === category.slug ? "border-[#facc15] bg-[#facc15]/15 text-[#facc15]" : "border-white/10 text-white/70 hover:border-white/30"}`}
              >
                <span>{category.name}</span>
                <span className="text-[10px] text-white/45">{category.products.length}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { setShowNewProduct(true); setNewProduct((current) => ({ ...current, categorySlug: selectedCategory })); }}
            disabled={!selectedCategory}
            onMouseEnter={(event) => {
              if (!event.currentTarget.disabled) {
                event.currentTarget.style.backgroundColor = "#c74346";
                event.currentTarget.style.transform = "translateY(-2px)";
                event.currentTarget.style.boxShadow = "0 10px 24px rgba(176, 51, 54, 0.42)";
              }
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.backgroundColor = "#B03336";
              event.currentTarget.style.transform = "translateY(0)";
              event.currentTarget.style.boxShadow = "0 4px 10px rgba(176, 51, 54, 0.2)";
            }}
            className="mt-4 w-full rounded-lg border border-[#B03336] bg-[#B03336] px-3 py-3 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-[#B03336]/20 transition duration-200 hover:-translate-y-0.5 hover:bg-[#c74346] hover:shadow-lg hover:shadow-[#B03336]/40 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-md"
            style={{ transition: "background-color 200ms ease, transform 200ms ease, box-shadow 200ms ease" }}
          >
            + Agregar producto
          </button>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#facc15]">Catálogo editable</p>
              <h2 className="mt-1 text-2xl font-black uppercase">{currentCategory?.name || "Menú"}</h2>
              <p className="mt-1 text-sm text-white/55">Los cambios se reflejan en `/menu` al guardar.</p>
            </div>
            {currentCategory && <p className="text-xs text-white/45">{currentCategory.products.filter((product) => product.active).length} activos de {currentCategory.products.length}</p>}
          </div>

          {error && <div role="alert" className="mb-4 rounded-xl border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">{error}</div>}
          {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-400/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">{notice}</div>}

          {showNewProduct && (
            <form onSubmit={createProduct} className="mb-5 rounded-2xl border border-[#B03336]/70 bg-[#201E1E] p-4 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-[#facc15]">Nuevo producto</h3>
                <button type="button" onClick={() => setShowNewProduct(false)} className="text-xs text-white/60 hover:text-white">Cancelar</button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Categoría
                  <select value={newProduct.categorySlug} onChange={(event) => setNewProduct({ ...newProduct, categorySlug: event.target.value })} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]">
                    {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Nombre
                  <input required value={newProduct.name} onChange={(event) => setNewProduct({ ...newProduct, name: event.target.value })} placeholder="Ej. HAMBURGUESA ESPECIAL" className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]" />
                </label>
                <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Precio individual
                  <input required type="number" min="0" step="500" value={newProduct.individualPrice} onChange={(event) => setNewProduct({ ...newProduct, individualPrice: Number(event.target.value) })} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]" />
                </label>
                <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Precio combo (opcional)
                  <input type="number" min="0" step="500" value={newProduct.comboPrice ?? ""} onChange={(event) => setNewProduct({ ...newProduct, comboPrice: event.target.value === "" ? null : Number(event.target.value) })} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]" />
                </label>
                <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70">Cantidad disponible (opcional)
                  <input type="number" min="0" step="1" value={newProduct.availableQuantity ?? ""} onChange={(event) => setNewProduct({ ...newProduct, availableQuantity: event.target.value === "" ? null : Number(event.target.value) })} placeholder="Vacío = ilimitado" className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]" />
                </label>
                <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70 md:col-span-2">Descripción
                  <textarea rows={2} value={newProduct.description} onChange={(event) => setNewProduct({ ...newProduct, description: event.target.value })} className="resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]" />
                </label>
                <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/70 md:col-span-2">Ruta local o URL de imagen
                  <input required value={newProduct.imageUrl} onChange={(event) => setNewProduct({ ...newProduct, imageUrl: event.target.value })} placeholder="Sube una imagen o pega una URL" className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]" />
                </label>
                <div className="flex flex-wrap items-center gap-3 md:col-span-2">
                  <AdminImageUploader
                    onUploaded={(url) => setNewProduct((current) => ({ ...current, imageUrl: url }))}
                    onError={setError}
                    onNotice={setNotice}
                  />
                  <span className="text-xs text-white/45">JPEG, PNG o WebP · máximo 4 MB</span>
                </div>
              </div>
              <button type="submit" disabled={creating} className="mt-4 rounded-lg border border-[#facc15] bg-[#d97706] px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:brightness-110 disabled:opacity-50">{creating ? "Creando..." : "Crear producto"}</button>
            </form>
          )}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-[#171717] px-6 py-20 text-center text-white/55">Cargando catálogo...</div>
          ) : !currentCategory ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-[#171717] px-6 py-20 text-center text-white/55">No hay categorías disponibles.</div>
          ) : (
            <div
              className="grid items-start gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))" }}
            >
              {currentCategory.products.map((product) => (
                <article key={product.id} className={`min-w-0 rounded-2xl border bg-[#201E1E] p-4 shadow-lg ${product.active ? "border-white/15" : "border-red-300/30 opacity-75"}`}>
                  <div className="mb-4 flex gap-3">
                    <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40" style={{ width: 96, height: 80 }}>
                      <img src={product.imageUrl} alt="" style={{ width: "100%", height: "100%", maxWidth: "100%", objectFit: "cover" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{product.active ? "Visible en menú" : "Oculto en menú"}</p>
                      <p className="mt-1 truncate text-sm font-black text-[#facc15]">{product.name || "Producto sin nombre"}</p>
                      <p className="mt-1 text-xs text-white/45">{formatCOP(Number(product.individualPrice))}</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60 sm:col-span-2">Nombre
                      <input value={product.name} onChange={(event) => updateProduct(product.id, "name", event.target.value)} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]" />
                    </label>
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">Categoría
                      <select value={product.categorySlug} onChange={(event) => updateProduct(product.id, "categorySlug", event.target.value)} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]">
                        {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
                      </select>
                    </label>
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">Orden
                      <input type="number" min="0" value={product.sortOrder} onChange={(event) => updateProduct(product.id, "sortOrder", Number(event.target.value))} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]" />
                    </label>
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">Precio individual
                      <input type="number" min="0" step="500" value={product.individualPrice} onChange={(event) => updateProduct(product.id, "individualPrice", Number(event.target.value))} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]" />
                    </label>
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">Precio combo
                      <input type="number" min="0" step="500" value={product.comboPrice ?? ""} onChange={(event) => updateProduct(product.id, "comboPrice", event.target.value === "" ? null : Number(event.target.value))} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]" />
                    </label>
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60">Cantidad disponible
                      <input type="number" min="0" step="1" value={product.availableQuantity ?? ""} onChange={(event) => updateProduct(product.id, "availableQuantity", event.target.value === "" ? null : Number(event.target.value))} placeholder="Ilimitado" className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#facc15]" />
                    </label>
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60 sm:col-span-2">Descripción
                      <textarea rows={2} value={product.description} onChange={(event) => updateProduct(product.id, "description", event.target.value)} className="resize-y rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]" />
                    </label>
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wider text-white/60 sm:col-span-2">Ruta local o URL de imagen
                      <input value={product.imageUrl} onChange={(event) => updateProduct(product.id, "imageUrl", event.target.value)} className="rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm normal-case tracking-normal text-white outline-none focus:border-[#facc15]" />
                    </label>
                    <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                      <AdminImageUploader
                        onUploaded={(url) => updateProduct(product.id, "imageUrl", url)}
                        onError={setError}
                        onNotice={setNotice}
                      />
                      <span className="text-xs text-white/45">JPEG, PNG o WebP · máximo 4 MB</span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <label className="flex items-center gap-2 text-xs font-bold text-white/75">
                      <input type="checkbox" checked={product.active} onChange={(event) => updateProduct(product.id, "active", event.target.checked)} className="h-4 w-4 accent-[#facc15]" />
                      Disponible en `/menu`
                    </label>
                    <button type="button" onClick={() => void saveProduct(product)} disabled={savingId === product.id} className="rounded-lg border border-[#facc15] bg-[#d97706] px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">{savingId === product.id ? "Guardando..." : "Guardar cambios"}</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
