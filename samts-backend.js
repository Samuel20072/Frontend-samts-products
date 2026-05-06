// ============================================================
// SAMTS — Endpoint para creación de productos con IA
// Stack: Node.js + Express + PostgreSQL + Cloudinary (imágenes)
// ============================================================
// npm install express pg cloudinary multer cors dotenv

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' })); // imágenes en base64 pueden pesar

// ── Base de datos ────────────────────────────────────────────
const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: String(process.env.DB_PASSWORD),
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// ── Cloudinary (almacenamiento de imágenes) ──────────────────
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// NOTA: Cloudinary tiene plan gratuito de 25GB — ideal para tu caso.
// Regístrate en cloudinary.com y copia las credenciales a tu .env

// ── Helpers ──────────────────────────────────────────────────

async function subirImagenCloudinary(base64, mimeType, nombreProducto) {
    const dataUri = `data:${mimeType};base64,${base64}`;
    const slug = nombreProducto
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 50);
    const result = await cloudinary.uploader.upload(dataUri, {
        folder: 'samts/productos',
        public_id: `${slug}-${Date.now()}`,
        transformation: [
            { width: 800, height: 800, crop: 'limit', quality: 85 },
        ],
    });
    return result.secure_url;
}

async function obtenerOCrearBrand(client, nombreMarca) {
    if (!nombreMarca) return null;
    const nombre = nombreMarca.trim();
    const buscar = await client.query(
        'SELECT id FROM brands WHERE LOWER(name) = LOWER($1) AND fecha_eliminacion IS NULL',
        [nombre]
    );
    if (buscar.rows.length > 0) return buscar.rows[0].id;
    const crear = await client.query(
        'INSERT INTO brands (name, creado_por) VALUES ($1, $2) RETURNING id',
        [nombre, 'samts-ia']
    );
    return crear.rows[0].id;
}

async function obtenerOCrearCategoria(client, nombreCategoria) {
    if (!nombreCategoria) return null;
    const nombre = nombreCategoria.trim();
    const slug = nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const buscar = await client.query(
        'SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND fecha_eliminacion IS NULL',
        [nombre]
    );
    if (buscar.rows.length > 0) return buscar.rows[0].id;
    const crear = await client.query(
        `INSERT INTO categories (name, slug, creado_por) VALUES ($1, $2, $3) RETURNING id`,
        [nombre, slug, 'samts-ia']
    );
    return crear.rows[0].id;
}

function generarSKU(marca, nombre) {
    const partes = [marca, nombre]
        .join(' ')
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 3)
        .map(p => p.slice(0, 3))
        .join('');
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${partes}-${num}`;
}

// ── Endpoint principal ───────────────────────────────────────

/**
 * POST /api/productos
 * Body: {
 *   nombre, marca, descripcion, categoria,
 *   tags (array), sku,
 *   precio (number), stock (number),
 *   imagenBase64 (string), imagenMimeType (string)
 * }
 */
app.post('/api/productos', async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            nombre,
            marca,
            descripcion,
            categoria,
            tags = [],
            sku,
            precio,
            stock,
            presentacion,
            imagen_url,
            imagenBase64,
            imagenMimeType,
        } = req.body;

        if (!nombre || !precio || (!imagenBase64 && !imagen_url)) {
            return res.status(400).json({ error: 'nombre, precio e imagen son requeridos' });
        }

        await client.query('BEGIN');

        // 1. Obtener URL de imagen (de internet o Cloudinary)
        let imagenUrlFinal = imagen_url;
        if (!imagenUrlFinal) {
            imagenUrlFinal = await subirImagenCloudinary(imagenBase64, imagenMimeType || 'image/jpeg', nombre);
        }

        // 2. Obtener o crear Brand
        const brandId = await obtenerOCrearBrand(client, marca);

        // 3. Obtener o crear Categoría
        const categoryId = await obtenerOCrearCategoria(client, categoria);

        // 4. Crear el producto
        const skuFinal = sku || generarSKU(marca || 'PRD', nombre);
        const { rows: [producto] } = await client.query(
            `INSERT INTO products (name, description, "categoryId", "brandId", creado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
            [nombre, descripcion, categoryId, brandId, 'samts-ia']
        );
        const productId = producto.id;

        // 5. Crear variante principal
        await client.query(
            `INSERT INTO product_variants
         (sku, name, price, "stockQuantity", "productId", creado_por)
       VALUES ($1, $2, $3, $4, $5, $6)`,
            [skuFinal, presentacion || 'Unidad', precio, stock || 0, productId, 'samts-ia']
        );

        // 6. Guardar imagen principal
        await client.query(
            `INSERT INTO product_images (url, "isMain", "productId", creado_por)
       VALUES ($1, TRUE, $2, $3)`,
            [imagenUrlFinal, productId, 'samts-ia']
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            producto: {
                id: productId,
                nombre,
                marca,
                categoria,
                sku: skuFinal,
                precio,
                stock,
                presentacion: presentacion || 'Unidad',
                imagenUrl: imagenUrlFinal,
                tags,
            },
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creando producto:', err);
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date() }));

// ── Inicio ───────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`SAMTS API corriendo en puerto ${PORT}`));