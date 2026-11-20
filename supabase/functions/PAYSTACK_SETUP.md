# Paystack setup

Use your **test** keys first (Paystack dashboard, Settings, API Keys & Webhooks).

1. Set the secrets (once; replace the values):

   ```
   supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx --project-ref pgjebqommrooixcfzsii
   supabase secrets set ALLOWED_ORIGINS=http://localhost:5174 --project-ref pgjebqommrooixcfzsii
   ```

   When the real website goes live, add its address, e.g.
   `ALLOWED_ORIGINS=http://localhost:5174,https://phrostys.com`.

2. Deploy the three functions. The website calls them with the public key, and Paystack
   calls the webhook with no login, so none of them use Supabase's JWT check (each
   protects itself: order number + email, or Paystack's signature):

   ```
   supabase functions deploy paystack-init    --no-verify-jwt --project-ref pgjebqommrooixcfzsii
   supabase functions deploy paystack-verify  --no-verify-jwt --project-ref pgjebqommrooixcfzsii
   supabase functions deploy paystack-webhook --no-verify-jwt --project-ref pgjebqommrooixcfzsii
   ```

3. In Paystack, Settings, API Keys & Webhooks, set the **Webhook URL** to
   `https://pgjebqommrooixcfzsii.supabase.co/functions/v1/paystack-webhook`.

4. Go live: swap in the `sk_live_` key (step 1 again) and add the live website address.

The secret key lives only in Supabase. It must never go in `apps/store`.
