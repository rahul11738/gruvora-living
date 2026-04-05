import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

export default function PricingStep({ baseData, setBaseData, children }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Price (INR)</Label>
          <Input
            type="number"
            value={baseData.pricing?.amount || ''}
            onChange={(e) =>
              setBaseData((prev) => ({
                ...prev,
                pricing: { ...prev.pricing, amount: e.target.value },
              }))
            }
            placeholder="25000"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Security deposit (optional)</Label>
          <Input
            type="number"
            value={baseData.pricing?.security_deposit || ''}
            onChange={(e) =>
              setBaseData((prev) => ({
                ...prev,
                pricing: { ...prev.pricing, security_deposit: e.target.value },
              }))
            }
            placeholder="75000"
            className="mt-1"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={baseData.pricing?.negotiable || false}
          onChange={(e) =>
            setBaseData((prev) => ({
              ...prev,
              pricing: { ...prev.pricing, negotiable: e.target.checked },
            }))
          }
        />
        <span className="text-sm">Price is negotiable</span>
      </label>

      {children}

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={baseData.is_draft || false}
          onChange={(e) => setBaseData((prev) => ({ ...prev, is_draft: e.target.checked }))}
        />
        <span className="text-sm">Save as draft</span>
      </label>
    </div>
  );
}
