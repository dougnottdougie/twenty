import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import { TwentyConfigService } from 'src/engine/core-modules/twenty-config/twenty-config.service';

/**
 * FORK-OWNED. AGPL.
 *
 * Replaces the access decision that upstream's EmailGroupAccessService makes,
 * for self-hosted instances that run the email group / campaign features from
 * their own code.
 *
 * This class is written independently and deliberately imports nothing from any
 * `/* @license Enterprise *\/` file. It is bound over the upstream token in
 * EmailingDomainModule via `useClass`, so upstream's class is never
 * instantiated and its billing/enterprise dependencies are never constructed.
 * Upstream's file itself is left completely untouched.
 *
 * Access is denied unless the operator explicitly opts in via
 * IS_SELF_HOSTED_EMAIL_GROUP_UNGATED, which is env-only so the decision lives in
 * version-controlled deployment config rather than a browser session.
 */
@Injectable()
export class SelfHostedEmailGroupAccessService {
  private readonly logger = new Logger(SelfHostedEmailGroupAccessService.name);

  constructor(private readonly twentyConfigService: TwentyConfigService) {}

  validateEmailGroupAccessOrThrow(): void {
    if (this.twentyConfigService.get('IS_SELF_HOSTED_EMAIL_GROUP_UNGATED')) {
      return;
    }

    this.logger.warn(
      'Email group access denied: set IS_SELF_HOSTED_EMAIL_GROUP_UNGATED=true to enable campaigns on this instance.',
    );

    throw new ForbiddenException(
      'Email group is not enabled on this instance. Set IS_SELF_HOSTED_EMAIL_GROUP_UNGATED=true to enable it.',
    );
  }
}
