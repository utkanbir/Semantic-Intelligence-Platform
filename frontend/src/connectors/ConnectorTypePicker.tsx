import {
  CONNECTOR_TYPE_LABELS,
  CONNECTOR_TYPES,
  type ConnectorType,
} from "../api/adapters";
import { ConnectorTypeIcon } from "./ConnectorTypeIcons";

interface ConnectorTypePickerProps {
  value: ConnectorType;
  onChange: (connectorType: ConnectorType) => void;
  disabled?: boolean;
}

export function ConnectorTypePicker({ value, onChange, disabled }: ConnectorTypePickerProps) {
  return (
    <div className="platform-page__field">
      <span className="connector-icon-picker__label" id="connector-type-label">
        Connector type
      </span>
      <div
        className="connector-icon-picker__grid"
        role="group"
        aria-labelledby="connector-type-label"
      >
        {CONNECTOR_TYPES.map((type) => {
          const selected = value === type;
          return (
            <button
              key={type}
              type="button"
              className={`connector-icon-picker__tile${selected ? " connector-icon-picker__tile--selected" : ""}`}
              aria-pressed={selected}
              aria-label={CONNECTOR_TYPE_LABELS[type]}
              disabled={disabled}
              onClick={() => onChange(type)}
            >
              <ConnectorTypeIcon connectorType={type} className="connector-icon-picker__icon" />
              <span className="connector-icon-picker__tile-label">
                {CONNECTOR_TYPE_LABELS[type]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
