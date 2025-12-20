import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { email, memberId, priceId } = req.body;

  try {
    let stripeCustomerId = null;

    try {
      const memberRes = await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
        headers: { Authorization: `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}` }
      });

      if (memberRes.ok) {
        const memberData = await memberRes.json();
        stripeCustomerId = memberData?.customFields?.stripeCustomerId || null;
      }
    } catch (e) {
      console.log('Could not fetch from Memberstack:', e.message);
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email.toLowerCase(),
        metadata: { memberId }
      });

      stripeCustomerId = customer.id;

      try {
        await fetch(`https://api.memberstack.io/v1/members/${memberId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customFields: { stripeCustomerId }
          })
        });
      } catch (e) {
        console.log('Error storing Stripe ID in Memberstack:', e.message);
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { trial_period_days: 2 },
      success_url: 'https://aisignalscout.com/dashboard.html',
      cancel_url: 'https://aisignalscout.com/?canceled=true'
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
