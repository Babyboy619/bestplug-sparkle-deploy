CREATE TABLE public.cart_items (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
CREATE POLICY cart_items_owner_access ON public.cart_items FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.wishlists (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
CREATE POLICY wishlists_owner_read ON public.wishlists FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY wishlists_owner_insert ON public.wishlists FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY wishlists_owner_delete ON public.wishlists FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.recently_viewed (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);
ALTER TABLE public.recently_viewed ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recently_viewed TO authenticated;
CREATE POLICY recently_viewed_owner_access ON public.recently_viewed FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX recently_viewed_user_date_idx ON public.recently_viewed(user_id, viewed_at DESC);

CREATE FUNCTION public.add_cart_item(_product_id uuid, _quantity integer DEFAULT 1)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid := auth.uid(); p public.products; new_quantity integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 20 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id AND published FOR UPDATE;
  IF NOT FOUND OR p.stock < 1 THEN RAISE EXCEPTION 'Product is unavailable'; END IF;
  INSERT INTO public.cart_items(user_id, product_id, quantity)
  VALUES (u, p.id, _quantity)
  ON CONFLICT (user_id, product_id) DO UPDATE
    SET quantity = LEAST(public.cart_items.quantity + EXCLUDED.quantity, 20), updated_at = now()
  RETURNING quantity INTO new_quantity;
  IF new_quantity > p.stock THEN RAISE EXCEPTION 'Requested quantity exceeds available stock'; END IF;
  RETURN new_quantity;
END $$;
REVOKE ALL ON FUNCTION public.add_cart_item(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_cart_item(uuid, integer) TO authenticated;

CREATE FUNCTION public.set_cart_item_quantity(_product_id uuid, _quantity integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u uuid := auth.uid(); p public.products; new_quantity integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 20 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id AND published FOR UPDATE;
  IF NOT FOUND OR p.stock < _quantity THEN RAISE EXCEPTION 'Requested quantity exceeds available stock'; END IF;
  UPDATE public.cart_items SET quantity = _quantity, updated_at = now()
    WHERE user_id = u AND product_id = p.id RETURNING quantity INTO new_quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cart item was not found'; END IF;
  RETURN new_quantity;
END $$;
REVOKE ALL ON FUNCTION public.set_cart_item_quantity(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cart_item_quantity(uuid, integer) TO authenticated;

CREATE FUNCTION public.purchase_cart_with_wallet(_request_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  u uuid := auth.uid();
  cart_row record;
  p public.products;
  w public.wallets;
  total numeric := 0;
  tx uuid;
  ord uuid;
  existing_order uuid;
  credential_ids uuid[];
  delivery text;
  order_data jsonb := '[]'::jsonb;
  purchased jsonb;
  item_product_id uuid;
  item_quantity integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF _request_reference IS NULL OR _request_reference !~ '^cart-[a-f0-9-]{36}$' THEN
    RAISE EXCEPTION 'Invalid checkout reference';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = u AND suspended) THEN
    RAISE EXCEPTION 'Account suspended';
  END IF;
  SELECT o.id INTO existing_order
    FROM public.wallet_transactions t JOIN public.orders o ON o.wallet_tx_id = t.id
    WHERE t.user_id = u AND t.reference = _request_reference;
  IF FOUND THEN RETURN existing_order; END IF;

  FOR cart_row IN
    SELECT product_id, quantity FROM public.cart_items WHERE user_id = u ORDER BY product_id FOR UPDATE
  LOOP
    SELECT * INTO p FROM public.products WHERE id = cart_row.product_id AND published FOR UPDATE;
    IF NOT FOUND OR p.stock < cart_row.quantity THEN RAISE EXCEPTION 'A cart product is no longer available'; END IF;
    IF p.currency <> 'NGN' THEN RAISE EXCEPTION 'Unsupported product currency'; END IF;
    total := total + p.price * cart_row.quantity;
    SELECT array_agg(c.id ORDER BY c.created_at) INTO credential_ids
      FROM (
        SELECT id, created_at FROM public.product_credentials
        WHERE product_id = p.id AND order_id IS NULL
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT cart_row.quantity
      ) c;
    IF COALESCE(cardinality(credential_ids), 0) < cart_row.quantity THEN
      RAISE EXCEPTION 'A cart product is currently out of stock';
    END IF;
    order_data := order_data || jsonb_build_array(jsonb_build_object(
      'product_id', p.id,
      'title', p.title,
      'unit_price', p.price,
      'quantity', cart_row.quantity,
      'credential_ids', to_jsonb(credential_ids)
    ));
  END LOOP;

  SELECT * INTO w FROM public.wallets WHERE user_id = u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  SELECT o.id INTO existing_order
    FROM public.wallet_transactions t JOIN public.orders o ON o.wallet_tx_id = t.id
    WHERE t.user_id = u AND t.reference = _request_reference;
  IF FOUND THEN RETURN existing_order; END IF;
  IF jsonb_array_length(order_data) = 0 OR total <= 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  IF w.currency <> 'NGN' THEN RAISE EXCEPTION 'Currency mismatch'; END IF;
  IF w.balance < total THEN RAISE EXCEPTION 'Insufficient wallet balance'; END IF;

  UPDATE public.wallets SET balance = balance - total, updated_at = now()
    WHERE id = w.id RETURNING balance INTO w.balance;
  INSERT INTO public.wallet_transactions(wallet_id, user_id, type, amount, balance_after, status, provider, reference, description, metadata)
  VALUES (w.id, u, 'debit', total, w.balance, 'success', 'manual', _request_reference,
    'Marketplace cart purchase', jsonb_build_object('items', order_data)) RETURNING id INTO tx;
  INSERT INTO public.orders(user_id, total, currency, status, wallet_tx_id)
  VALUES (u, total, 'NGN', 'completed', tx) RETURNING id INTO ord;

  FOR purchased IN SELECT value FROM jsonb_array_elements(order_data)
  LOOP
    item_product_id := (purchased->>'product_id')::uuid;
    item_quantity := (purchased->>'quantity')::integer;
    SELECT array_agg(value::uuid) INTO credential_ids
      FROM jsonb_array_elements_text(purchased->'credential_ids') AS ids(value);
    UPDATE public.products SET stock = stock - item_quantity, updated_at = now() WHERE id = item_product_id;
    UPDATE public.product_credentials SET order_id = ord, assigned_to = u, delivered_at = now()
      WHERE id = ANY(credential_ids);
    SELECT string_agg(content, E'\n---\n' ORDER BY created_at) INTO delivery
      FROM public.product_credentials WHERE id = ANY(credential_ids);
    INSERT INTO public.order_items(order_id, product_id, title, unit_price, quantity, delivered_payload)
      VALUES (ord, item_product_id, purchased->>'title', (purchased->>'unit_price')::numeric, item_quantity, delivery);
  END LOOP;

  DELETE FROM public.cart_items WHERE user_id = u;
  RETURN ord;
END $$;
REVOKE ALL ON FUNCTION public.purchase_cart_with_wallet(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_cart_with_wallet(text) TO authenticated;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
CREATE POLICY profile_avatars_public_read ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'profile-avatars');
CREATE POLICY profile_avatars_owner_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY profile_avatars_owner_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY profile_avatars_owner_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);