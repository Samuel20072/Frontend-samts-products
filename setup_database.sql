-- 1. Crear tabla de MARCAS (brands)
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_eliminacion TIMESTAMPTZ
);

-- 2. Crear tabla de CATEGORÍAS (categories)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    slug VARCHAR(255),
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_eliminacion TIMESTAMPTZ
);

-- 3. Crear tabla de PRODUCTOS (products)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    "categoryId" INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    "brandId" INTEGER REFERENCES brands(id) ON DELETE SET NULL,
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_eliminacion TIMESTAMPTZ
);

-- 4. Crear tabla de VARIANTES (product_variants)
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(255) UNIQUE,
    name VARCHAR(255),
    price DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stockQuantity" INTEGER DEFAULT 0,
    "productId" INTEGER REFERENCES products(id) ON DELETE CASCADE,
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_eliminacion TIMESTAMPTZ
);

-- 5. Crear tabla de IMÁGENES (product_images)
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    "isMain" BOOLEAN DEFAULT FALSE,
    "productId" INTEGER REFERENCES products(id) ON DELETE CASCADE,
    creado_por VARCHAR(255),
    actualizado_por VARCHAR(255),
    fecha_creacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    fecha_eliminacion TIMESTAMPTZ
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_products_category ON products("categoryId");
CREATE INDEX idx_products_brand ON products("brandId");
CREATE INDEX idx_variants_product ON product_variants("productId");
CREATE INDEX idx_images_product ON product_images("productId");
