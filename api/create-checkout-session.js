import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'POST only' });
  }

  const { email, memberId, priceId } = req.body;

  try {
    let stripeCustomerId = null;
    let memberHasStripeId = false;
    let trialUsed = false;

    try {
      const memberRes = await fetch(`https://admin.memberstack.com/members/${memberId}`, {
        headers: {
          'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (memberRes.ok) {
        const memberData = await memberRes.json();
        stripeCustomerId = memberData?.data?.customFields?.stripeCustomerId || null;
        memberHasStripeId = !!stripeCustomerId;
        console.log(`MemberStack fetch successful. Stripe ID: ${stripeCustomerId || 'none'}`);
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
      memberHasStripeId = false;
      console.log(`✅ Created new Stripe customer: ${stripeCustomerId}`);
    } else {
      try {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomerId,
          limit: 1,
          status: 'all'
        });
        trialUsed = subscriptions.data.length > 0;
        console.log(`Customer ${stripeCustomerId}: Has ${subscriptions.data.length} past subscription(s)`);
      } catch (e) {
        console.log('Could not retrieve customer subscriptions:', e.message);
      }
    }

    if (!memberHasStripeId && stripeCustomerId) {
      try {
        const saveRes = await fetch(`https://admin.memberstack.com/members/${memberId}`, {
          method: 'PATCH',
          headers: {
            'X-API-KEY': process.env.MEMBERSTACK_SECRET_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customFields: {
              stripeCustomerId: stripeCustomerId
            }
          })
        });

        if (saveRes.ok) {
          console.log(`✅ Stripe ID ${stripeCustomerId} saved to Memberstack`);
        }
      } catch (e) {
        console.log('❌ Error saving to Memberstack:', e.message);
      }
    }

    const trialPeriodDays = trialUsed ? 0 : 2;
    console.log(`Creating subscription with trial_period_days: ${trialPeriodDays}`);

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      metadata: { memberId },
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      subscription_data: {
        trial_period_days: trialPeriodDays
      },
      success_url: `https://aisignalscout.com/dashboard.html?success=true`,
      cancel_url: `https://aisignalscout.com?canceled=true`
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
