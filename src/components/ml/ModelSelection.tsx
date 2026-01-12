import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Brain, Trees, Rocket, Target } from 'lucide-react';

interface ModelSelectionProps {
  selectedModels: { rf: boolean; gb: boolean; lr: boolean };
  onChange: (models: { rf: boolean; gb: boolean; lr: boolean }) => void;
}

export function ModelSelection({ selectedModels, onChange }: ModelSelectionProps) {
  const toggleModel = (key: 'rf' | 'gb' | 'lr') => {
    onChange({
      ...selectedModels,
      [key]: !selectedModels[key],
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          ML Model Selection
        </CardTitle>
        <CardDescription>
          Choose which machine learning models to train and compare
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-4">
          {/* Random Forest */}
          <div
            onClick={() => toggleModel('rf')}
            className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
              selectedModels.rf
                ? 'border-green-600 bg-green-600/10'
                : 'border-muted hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <Trees className={`h-6 w-6 ${selectedModels.rf ? 'text-green-600' : 'text-muted-foreground'}`} />
              <Checkbox checked={selectedModels.rf} />
            </div>
            <Label className="font-medium cursor-pointer">Random Forest</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Ensemble of decision trees. Great for capturing non-linear patterns.
            </p>
          </div>

          {/* Gradient Boosting */}
          <div
            onClick={() => toggleModel('gb')}
            className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
              selectedModels.gb
                ? 'border-blue-600 bg-blue-600/10'
                : 'border-muted hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <Rocket className={`h-6 w-6 ${selectedModels.gb ? 'text-blue-600' : 'text-muted-foreground'}`} />
              <Checkbox checked={selectedModels.gb} />
            </div>
            <Label className="font-medium cursor-pointer">Gradient Boosting</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Sequential boosting. Often achieves best accuracy.
            </p>
          </div>

          {/* Logistic Regression */}
          <div
            onClick={() => toggleModel('lr')}
            className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
              selectedModels.lr
                ? 'border-purple-600 bg-purple-600/10'
                : 'border-muted hover:border-muted-foreground/30'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <Target className={`h-6 w-6 ${selectedModels.lr ? 'text-purple-600' : 'text-muted-foreground'}`} />
              <Checkbox checked={selectedModels.lr} />
            </div>
            <Label className="font-medium cursor-pointer">Logistic Regression</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Linear classifier. Fast and interpretable baseline.
            </p>
          </div>
        </div>

        {!selectedModels.rf && !selectedModels.gb && !selectedModels.lr && (
          <p className="text-sm text-destructive mt-4">
            Please select at least one model to train
          </p>
        )}
      </CardContent>
    </Card>
  );
}
