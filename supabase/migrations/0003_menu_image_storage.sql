-- Storage bucket for menu item photos. Images are public to read (diners
-- need to see them with no login), but only owner/admin staff of the
-- restaurant that "owns" a given folder can upload/replace/delete into it.
-- Files are expected at the path "{restaurant_id}/{filename}".

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "public can view menu images"
on storage.objects for select
using (bucket_id = 'menu-images');

create policy "owner/admin can upload menu images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'menu-images'
  and public.is_restaurant_staff((storage.foldername(name))[1]::uuid, array['owner', 'admin']::restaurant_role[])
);

create policy "owner/admin can update menu images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'menu-images'
  and public.is_restaurant_staff((storage.foldername(name))[1]::uuid, array['owner', 'admin']::restaurant_role[])
);

create policy "owner/admin can delete menu images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'menu-images'
  and public.is_restaurant_staff((storage.foldername(name))[1]::uuid, array['owner', 'admin']::restaurant_role[])
);
