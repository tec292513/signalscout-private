import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const { memberId } = req.body;

  try {
    let stripeCustomerId = null;

    try {
      const memberRes = await fetch(`https://api.memberstack.com/v1/members/${memberId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.MEMBERSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (memberRes.ok) {
        const memberData = await memberRes.json();
        stripeCustomerId = memberData?.data?.customFields?.stripeCustomerId;
      }
    } catch (e) {
      console.log('Could not fetch from MemberStack:', e.message);
    }

    if (!stripeCustomerId) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    console.log('Creating portal session for:', stripeCustomerId);
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: 'https://aisignalscout.com/dashboard.html'
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
