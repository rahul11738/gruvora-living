import { ImageUploader } from '../../FileUpload';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';

export default function MediaStep({ baseData, setBaseData, label = 'Listing images (up to 15)' }) {
  return (
    <div className="space-y-4">
      <Label>{label}</Label>
      <ImageUploader
        images={(baseData.media?.images || []).map((url) => (typeof url === 'string' ? { url } : url))}
        onImagesChange={(images) =>
          setBaseData((prev) => ({
            ...prev,
            media: {
              ...prev.media,
              images,
            },
          }))
        }
        maxImages={15}
        folder="listings"
      />
      <div>
        <Label>Floor plan URL (optional)</Label>
        <Input
          value={baseData.media?.floor_plan_url || ''}
          onChange={(e) =>
            setBaseData((prev) => ({
              ...prev,
              media: { ...prev.media, floor_plan_url: e.target.value },
            }))
          }
          placeholder="https://..."
          className="mt-1"
        />
      </div>
      <div>
        <Label>Virtual tour URL (optional)</Label>
        <Input
          value={baseData.media?.virtual_tour_url || ''}
          onChange={(e) =>
            setBaseData((prev) => ({
              ...prev,
              media: { ...prev.media, virtual_tour_url: e.target.value },
            }))
          }
          placeholder="https://..."
          className="mt-1"
        />
      </div>
    </div>
  );
}
