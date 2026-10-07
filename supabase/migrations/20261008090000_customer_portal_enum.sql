-- Customer portal, part 1: enum value used by part 2.
-- (A new enum value cannot be used in the same transaction that adds it, so
-- it gets its own migration.)

-- Renewal requests a signed-in customer sends from /customer.
alter type public.enquiry_source add value if not exists 'customer_portal';
