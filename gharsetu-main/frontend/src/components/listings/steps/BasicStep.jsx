import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';

export default function BasicStep({ baseData, setBaseData }) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Listing title</Label>
        <Input
          value={baseData.title}
          onChange={(e) => setBaseData((prev) => ({ ...prev, title: e.target.value }))}
          placeholder="e.g. Spacious 3 BHK in Vesu"
          className="mt-1"
        />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={baseData.description}
          onChange={(e) => setBaseData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Describe your listing in detail..."
          rows={4}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Location / Area</Label>
          <Input
            value={baseData.location}
            onChange={(e) => setBaseData((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="Vesu Main Road"
            className="mt-1"
          />
        </div>
        <div>
          <Label>City</Label>
          <Input
            value={baseData.city}
            onChange={(e) => setBaseData((prev) => ({ ...prev, city: e.target.value }))}
            placeholder="Surat"
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Contact phone</Label>
          <Input
            value={baseData.contact_phone}
            onChange={(e) => setBaseData((prev) => ({ ...prev, contact_phone: e.target.value }))}
            placeholder="+91 9876543210"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Contact email</Label>
          <Input
            type="email"
            value={baseData.contact_email}
            onChange={(e) => setBaseData((prev) => ({ ...prev, contact_email: e.target.value }))}
            placeholder="owner@email.com"
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}
