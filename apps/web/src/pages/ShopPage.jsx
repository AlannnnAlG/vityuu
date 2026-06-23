import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart as CartIcon, Star, Package, Search,
  SlidersHorizontal, X, ChevronRight, Zap, Heart,
  CheckCircle2, ArrowRight, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Header from '@/components/Header.jsx';
import Footer from '@/components/Footer.jsx';
import pb from '@/lib/pocketbaseClient.js';
import { addToCart } from '@/lib/cartUtils.js';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'all',      label: 'Semua' },
  { value: 'skincare', label: 'Skincare' },
  { value: 'makeup',   label: 'Makeup' },
  { value: 'haircare', label: 'Haircare' },
  { value: 'bodycare', label: 'Bodycare' },
];

// ─── Quick View Modal ─────────────────────────────────────────────────────────

const QuickViewModal = ({ product, onClose, onAddToCart, onGoDetail }) => {
  const imageUrl = product.gambar_produk
    ? pb.files.getURL(product, product.gambar_produk)
    : null;
  const hasDiscount = product.harga_diskon && product.harga_diskon < product.harga;
  const discountPct = hasDiscount
    ? Math.round(((product.harga - product.harga_diskon) / product.harga) * 100)
    : 0;

  // Close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={handleBackdrop}
      >
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative bg-white dark:bg-gray-900 w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
          style={{ maxHeight: '90vh' }}
        >
          {/* Close btn */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-gray-700 dark:text-gray-300 hover:bg-black/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row overflow-y-auto" style={{ maxHeight: '90vh' }}>

            {/* Image panel */}
            <div className="relative sm:w-[45%] flex-shrink-0 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 flex items-center justify-center p-8 min-h-[240px]">
              {hasDiscount && (
                <div className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Tag className="w-3 h-3" /> -{discountPct}%
                </div>
              )}
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.nama_produk}
                  className="w-full max-h-56 object-contain drop-shadow-xl"
                />
              ) : (
                <Package className="w-24 h-24 text-emerald-300" />
              )}
            </div>

            {/* Info panel */}
            <div className="flex-1 p-6 sm:p-8 flex flex-col gap-4">
              {/* Badge kategori */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                  {product.kategori || 'Produk'}
                </span>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">4.9</span>
                  <span className="text-xs text-gray-400">(124 ulasan)</span>
                </div>
              </div>

              {/* Nama */}
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                {product.nama_produk}
              </h2>

              {/* Harga */}
              <div className="flex items-end gap-3">
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  Rp {(product.harga_diskon || product.harga).toLocaleString('id-ID')}
                </span>
                {hasDiscount && (
                  <span className="text-sm text-gray-400 line-through mb-0.5">
                    Rp {product.harga.toLocaleString('id-ID')}
                  </span>
                )}
              </div>

              {/* Deskripsi singkat */}
              {product.deskripsi && (
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
                  {product.deskripsi}
                </p>
              )}

              {/* Keunggulan singkat */}
              <div className="space-y-1.5">
                {['Bahan alami pilihan', 'Gratis ongkir min. Rp 200rb', 'Garansi uang kembali 7 hari'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => { onAddToCart(product); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold py-3 rounded-2xl transition-all shadow-md shadow-emerald-200 dark:shadow-emerald-900/30 active:scale-[0.98]"
                >
                  <CartIcon className="w-4 h-4" /> Tambah ke Keranjang
                </button>
                <button
                  onClick={onGoDetail}
                  className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-2xl hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 transition-all"
                >
                  Halaman Produk Lengkap <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─── Product Card ─────────────────────────────────────────────────────────────

const ProductCard = ({ product, index, onQuickView, onAddToCart }) => {
  const imageUrl = product.gambar_produk
    ? pb.files.getURL(product, product.gambar_produk)
    : null;
  const hasDiscount = product.harga_diskon && product.harga_diskon < product.harga;
  const discountPct = hasDiscount
    ? Math.round(((product.harga - product.harga_diskon) / product.harga) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay: index * 0.05 }}
      className="group relative flex flex-col bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-2xl hover:shadow-gray-200/60 dark:hover:shadow-black/40 hover:-translate-y-1.5 transition-all duration-300"
    >
      {/* Image area */}
      <Link to={`/shop/${product.id}`} className="block relative aspect-square bg-gradient-to-br from-gray-50 to-emerald-50/30 dark:from-gray-800 dark:to-emerald-950/20 overflow-hidden flex items-center justify-center p-6">
        {hasDiscount && (
          <span className="absolute top-3 left-3 z-10 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            -{discountPct}%
          </span>
        )}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.nama_produk}
            className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500 drop-shadow-lg"
          />
        ) : (
          <Package className="w-16 h-16 text-gray-300" />
        )}

        {/* Quick view overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        <button
          onClick={(e) => { e.preventDefault(); onQuickView(product); }}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
        >
          <span className="bg-white dark:bg-gray-900 text-gray-800 dark:text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-emerald-500 hover:text-white transition-colors">
            <Zap className="w-3.5 h-3.5" /> Quick View
          </span>
        </button>
      </Link>

      {/* Card body */}
      <div className="flex flex-col flex-grow p-4">
        {/* Rating + kategori */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
            {product.kategori || 'Produk'}
          </span>
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200">4.9</span>
          </div>
        </div>

        {/* Nama produk */}
        <Link to={`/shop/${product.id}`}>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1 line-clamp-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors leading-snug">
            {product.nama_produk}
          </h3>
        </Link>

        {/* Deskripsi */}
        {product.deskripsi && (
          <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 mb-3 leading-relaxed flex-grow">
            {product.deskripsi}
          </p>
        )}

        {/* Harga */}
        <div className="mt-auto">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-lg font-extrabold text-gray-900 dark:text-white">
              Rp {(product.harga_diskon || product.harga).toLocaleString('id-ID')}
            </span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">
                Rp {product.harga.toLocaleString('id-ID')}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => { e.preventDefault(); onAddToCart(product); }}
              className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-bold py-2.5 rounded-xl transition-all shadow-sm shadow-emerald-200 dark:shadow-emerald-900/20 active:scale-95"
            >
              <CartIcon className="w-3.5 h-3.5" /> Tambah
            </button>
            <button
              onClick={(e) => { e.preventDefault(); onQuickView(product); }}
              className="flex items-center justify-center gap-1 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-semibold py-2.5 rounded-xl hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400 transition-all bg-gray-50 dark:bg-gray-800 active:scale-95"
            >
              <ChevronRight className="w-3.5 h-3.5" /> Detail
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ShopPage = () => {
  const navigate = useNavigate();
  const [products, setProducts]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const records = await pb.collection('products').getFullList({
          filter: 'status = "published" && (is_deleted = false || is_deleted = null)',
          sort: '-created',
          $autoCancel: false,
        });
        setProducts(records);
      } catch (err) {
        console.error(err);
        toast.error('Gagal memuat produk');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const handleAddToCart = useCallback((product) => {
    const cartItem = {
      id: product.id,
      name: product.nama_produk,
      price: product.harga_diskon || product.harga,
      image: product.gambar_produk ? pb.files.getURL(product, product.gambar_produk) : null,
    };
    addToCart(cartItem, 1);
    toast.success(`${product.nama_produk} ditambahkan ke keranjang`);
  }, []);

  const filtered = products.filter((p) => {
    const matchSearch = p.nama_produk.toLowerCase().includes(search.toLowerCase());
    const matchCat    = activeCategory === 'all' || p.kategori === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <>
      <Helmet>
        <title>Toko Vityuu - Produk Pengendali Gula Alami</title>
        <meta name="description" content="Katalog resmi produk Vityuu. Dapatkan Diet Sugar Spray, Miracle Tea, dan Paket Reseller." />
      </Helmet>

      <div className="min-h-screen bg-[#f8f9fb] dark:bg-gray-950 pb-20 font-sans">
        <Header />

        {/* Hero */}
        <section className="py-16 bg-gradient-to-b from-white dark:from-gray-900 to-transparent border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-4 py-1.5 rounded-full mb-4">
                Koleksi Terlengkap
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
                Katalog <span className="bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">Produk Vityuu</span>
              </h1>
              <p className="text-base text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
                Solusi terlengkap untuk membantu rutinitas diet gula harian Anda.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Filter & Search — sticky */}
        <section className="py-4 border-b border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 sticky top-0 z-30 backdrop-blur-md shadow-sm shadow-gray-100/50 dark:shadow-black/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Cari produk..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full sm:w-auto">
              <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setActiveCategory(cat.value)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all border ${
                    activeCategory === cat.value
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-white border-transparent shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-emerald-400 hover:text-emerald-600'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Products */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Result count */}
            {!loading && filtered.length > 0 && (
              <p className="text-sm text-gray-400 mb-6">
                Menampilkan <span className="font-bold text-gray-700 dark:text-gray-200">{filtered.length}</span> produk
                {activeCategory !== 'all' && ` · ${CATEGORIES.find(c => c.value === activeCategory)?.label}`}
              </p>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-1/3" />
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-full w-3/4" />
                      <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full w-full" />
                      <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded-full w-1/2" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                        <div className="h-9 bg-gray-100 dark:bg-gray-800 rounded-xl" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-24 flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Package className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">Produk tidak ditemukan</h3>
                <p className="text-gray-400 text-sm max-w-xs">
                  {search || activeCategory !== 'all'
                    ? 'Coba ubah filter atau kata kunci pencarian.'
                    : 'Belum ada produk yang ditambahkan oleh admin.'}
                </p>
                {(search || activeCategory !== 'all') && (
                  <button
                    onClick={() => { setSearch(''); setActiveCategory('all'); }}
                    className="text-sm font-semibold text-emerald-600 hover:underline"
                  >
                    Reset filter
                  </button>
                )}
              </div>
            )}

            {/* Product grid */}
            {!loading && filtered.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {filtered.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    index={index}
                    onQuickView={setQuickViewProduct}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <Footer />
      </div>

      {/* Quick View Modal */}
      {quickViewProduct && (
        <QuickViewModal
          product={quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
          onAddToCart={(p) => { handleAddToCart(p); setQuickViewProduct(null); }}
          onGoDetail={() => { navigate(`/shop/${quickViewProduct.id}`); setQuickViewProduct(null); }}
        />
      )}
    </>
  );
};

export default ShopPage;
