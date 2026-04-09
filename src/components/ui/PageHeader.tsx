import React from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  style,
  ...rest
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "0.75rem",
      padding: "1.5rem 0",
      ...style,
    }}
    {...rest}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "0.25rem 0 0 0",
              color: "#6b7280",
              fontSize: "1rem",
              fontWeight: 400,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          style={{
            marginTop: "0.5rem",
            display: "flex",
            flexDirection: "row",
            gap: "0.5rem",
            flexShrink: 0,
          }}
        >
          {actions}
        </div>
      )}
    </div>
  </div>
);

export default PageHeader;