-- ============ enums ============
DO $$ BEGIN
  CREATE TYPE public.group_order_status AS ENUM ('draft','active','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('pending','paid','shipped','completed','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ group_orders ============
CREATE TABLE public.group_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  status public.group_order_status NOT NULL DEFAULT 'active',
  title text NOT NULL DEFAULT '',
  cover_image_url text,
  snapshot_intro jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_skus jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  closed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  order_count integer NOT NULL DEFAULT 0,
  items_sold integer NOT NULL DEFAULT 0,
  gmv_cents bigint NOT NULL DEFAULT 0,
  external_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.group_orders TO service_role;
ALTER TABLE public.group_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct client access to group_orders"
  ON public.group_orders FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX group_orders_owner_idx ON public.group_orders(owner_id);
CREATE INDEX group_orders_project_idx ON public.group_orders(project_id);
CREATE INDEX group_orders_status_idx ON public.group_orders(status);
CREATE TRIGGER group_orders_touch_updated_at
  BEFORE UPDATE ON public.group_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ orders ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_order_id uuid NOT NULL REFERENCES public.group_orders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  order_no text NOT NULL UNIQUE,
  query_code text NOT NULL,
  buyer_phone text NOT NULL,
  buyer_name text NOT NULL,
  address jsonb NOT NULL,
  note text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'h5',
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  tracking_no text,
  shipping_carrier text,
  items_count integer NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL DEFAULT 0,
  paid_at timestamptz,
  shipped_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct client access to orders"
  ON public.orders FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX orders_owner_idx ON public.orders(owner_id);
CREATE INDEX orders_group_order_idx ON public.orders(group_order_id);
CREATE INDEX orders_project_idx ON public.orders(project_id);
CREATE INDEX orders_buyer_phone_idx ON public.orders(buyer_phone);
CREATE INDEX orders_status_idx ON public.orders(status);
CREATE INDEX orders_created_at_idx ON public.orders(created_at DESC);
CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ order_items ============
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sku_index integer NOT NULL DEFAULT 0,
  variant_index integer,
  sku_name text NOT NULL,
  variant_label text NOT NULL DEFAULT '',
  image_url text,
  unit_price_cents bigint NOT NULL DEFAULT 0,
  qty integer NOT NULL DEFAULT 1,
  subtotal_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny direct client access to order_items"
  ON public.order_items FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);