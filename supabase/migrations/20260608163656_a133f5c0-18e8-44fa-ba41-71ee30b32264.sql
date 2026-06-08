
CREATE POLICY "Public read product-images" ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');
CREATE POLICY "Public insert product-images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "Public update product-images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images');
CREATE POLICY "Public delete product-images" ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images');
