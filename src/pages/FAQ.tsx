import { MainNav } from '@/components/MainNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

const faqItems = [
  {
    category: 'General',
    questions: [
      {
        q: 'What is Cluster?',
        a: 'Cluster is a platform that connects algorithmic trading model developers with retail traders. Developers can create, backtest, and publish trading strategies, while traders can subscribe to these models and have them automatically execute trades on their behalf.',
      },
      {
        q: 'How do I get started?',
        a: 'Sign up for an account and choose your role: Developer (to create trading models) or Retail Trader (to subscribe to models). Complete the onboarding tour to learn about key features.',
      },
      {
        q: 'Is Cluster free to use?',
        a: 'Creating an account is free. Developers can publish models with performance-based fees. Traders pay subscription fees to model creators based on performance.',
      },
    ],
  },
  {
    category: 'Trading & Models',
    questions: [
      {
        q: 'How does automated trading work?',
        a: 'Once you connect your brokerage account and subscribe to a model, the system automatically executes trades based on the model\'s signals. You maintain full control and can stop automation at any time.',
      },
      {
        q: 'What brokerages are supported?',
        a: 'We currently support Alpaca for both paper (simulated) and live trading. More brokerages will be added in the future.',
      },
      {
        q: 'Can I lose money?',
        a: 'Yes. All trading involves risk. Past performance of any model is not indicative of future results. Never trade with money you cannot afford to lose.',
      },
      {
        q: 'How are trading models validated?',
        a: 'All models go through backtesting against historical data. We display key metrics like Sharpe ratio, max drawdown, and win rate to help you evaluate performance.',
      },
    ],
  },
  {
    category: 'Account & Security',
    questions: [
      {
        q: 'How do I secure my account?',
        a: 'We strongly recommend enabling Multi-Factor Authentication (MFA) in your Profile settings. This adds an extra layer of security using authenticator apps like Google Authenticator.',
      },
      {
        q: 'Are my brokerage credentials safe?',
        a: 'Yes. API keys are encrypted before storage and are never exposed in plaintext. We use industry-standard encryption protocols.',
      },
      {
        q: 'Can I delete my account?',
        a: 'Yes. Contact support to request account deletion. Note that some data may be retained for legal compliance purposes.',
      },
    ],
  },
  {
    category: 'SMS & Communications',
    questions: [
      {
        q: 'What text messages will I receive?',
        a: 'If opted in, you may receive trading alerts, security verifications (2FA), important account updates, and promotional messages (if separately consented).',
      },
      {
        q: 'How do I opt out of text messages?',
        a: 'Reply STOP to any message to unsubscribe. You can also manage preferences in your Profile settings.',
      },
      {
        q: 'Are there any charges for SMS?',
        a: 'Standard message and data rates from your carrier may apply. Cluster does not charge for sending messages.',
      },
    ],
  },
  {
    category: 'Legal & Compliance',
    questions: [
      {
        q: 'Is Cluster a registered investment advisor?',
        a: 'No. Cluster is a technology platform that connects model creators with traders. We do not provide investment advice.',
      },
      {
        q: 'How is my data protected?',
        a: 'We comply with data protection regulations and implement technical safeguards. See our Privacy Policy for details.',
      },
      {
        q: 'Where can I find the Terms of Service?',
        a: 'Our Terms of Service are available in the Legal menu in the navigation bar, or at /terms.',
      },
    ],
  },
];

export default function FAQ() {
  return (
    <div className="min-h-screen bg-background">
      <MainNav />
      <div className="container py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Frequently Asked Questions</CardTitle>
            <p className="text-muted-foreground">Find answers to common questions about Cluster</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {faqItems.map((category) => (
                <div key={category.category}>
                  <h2 className="text-lg font-semibold mb-4 text-primary">{category.category}</h2>
                  <Accordion type="single" collapsible className="w-full">
                    {category.questions.map((item, index) => (
                      <AccordionItem key={index} value={`${category.category}-${index}`}>
                        <AccordionTrigger className="text-left">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
