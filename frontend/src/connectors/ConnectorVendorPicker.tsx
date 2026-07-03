import type { ConnectorType } from "../api/adapters";
import { VENDORS_BY_CONNECTOR_TYPE } from "./catalog";
import { ConnectorVendorIcon } from "./ConnectorVendorIcons";

interface ConnectorVendorPickerProps {
  connectorType: ConnectorType;
  value: string;
  onChange: (vendorId: string) => void;
  disabled?: boolean;
}

export function ConnectorVendorPicker({
  connectorType,
  value,
  onChange,
  disabled,
}: ConnectorVendorPickerProps) {
  const vendors = VENDORS_BY_CONNECTOR_TYPE[connectorType];

  return (
    <div className="platform-page__field">
      <span className="connector-icon-picker__label" id="connector-vendor-label">
        Connector vendor
      </span>
      <div
        className="connector-icon-picker__grid connector-icon-picker__grid--vendors"
        role="group"
        aria-labelledby="connector-vendor-label"
      >
        {vendors.map((vendor) => {
          const selected = value === vendor.id;
          return (
            <button
              key={vendor.id}
              type="button"
              className={`connector-icon-picker__tile${selected ? " connector-icon-picker__tile--selected" : ""}`}
              aria-pressed={selected}
              aria-label={vendor.label}
              disabled={disabled}
              onClick={() => onChange(vendor.id)}
            >
              <ConnectorVendorIcon vendorId={vendor.id} className="connector-icon-picker__icon" />
              <span className="connector-icon-picker__tile-label">{vendor.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
