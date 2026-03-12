import {
  Controller,
  HttpException,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { StripeService } from '@xpoz/nestjs-libraries/services/stripe.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Stripe')
@Controller('/stripe')
export class StripeController {
  constructor(
    private readonly _stripeService: StripeService,
  ) {}

  @Post('/')
  stripe(@Req() req: RawBodyRequest<Request>) {
    // Stripe billing disabled — webhook events are not processed
    return { ok: true };

    /* --- Original Stripe webhook handler (disabled) ---
    const event = this._stripeService.validateRequest(
      req.rawBody,
      // @ts-ignore
      req.headers['stripe-signature'],
      process.env.STRIPE_SIGNING_KEY
    );

    if (
      event?.data?.object?.metadata?.service !== 'xpoz' &&
      event?.data?.object?.metadata?.service !== 'gitroom' &&
      event.type !== 'invoice.payment_succeeded'
    ) {
      return { ok: true };
    }

    try {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          return this._stripeService.paymentSucceeded(event);
        case 'customer.subscription.created':
          return this._stripeService.createSubscription(event);
        case 'customer.subscription.updated':
          return this._stripeService.updateSubscription(event);
        case 'customer.subscription.deleted':
          return this._stripeService.deleteSubscription(event);
        default:
          return { ok: true };
      }
    } catch (e) {
      throw new HttpException(e, 500);
    }
    --- End of original Stripe webhook handler --- */
  }
}
