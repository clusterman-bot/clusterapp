import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, MoreHorizontal } from 'lucide-react';

interface TrendingTopic {
  category: string;
  topic: string;
  posts: number;
}

const mockTrending: TrendingTopic[] = [
  { category: 'Quant Trading', topic: 'Momentum Strategies', posts: 2453 },
  { category: 'Markets', topic: 'Fed Rate Decision', posts: 15200 },
  { category: 'Crypto', topic: 'Bitcoin ETF', posts: 8764 },
  { category: 'AI Trading', topic: 'LLM-based Signals', posts: 1287 },
  { category: 'Risk Management', topic: 'Drawdown Control', posts: 892 },
];

export function TrendingTopics() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Trending in Trading
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {mockTrending.map((item, index) => (
          <div key={index} className="group cursor-pointer">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{item.category}</p>
                <p className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {item.topic}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.posts.toLocaleString()} posts
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button 
          variant="link" 
          className="p-0 h-auto text-primary text-sm"
        >
          Show more
        </Button>
      </CardContent>
    </Card>
  );
}
