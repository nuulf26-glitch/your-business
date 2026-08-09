import { useEffect, useMemo, useState } from "react";
import "../styles/customers.css";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("en-US");
}

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const savedCustomers = localStorage.getItem("businessCustomers");

    if (!savedCustomers) {
      setCustomers([]);
      return;
    }

    try {
      const parsed = JSON.parse(savedCustomers);
      setCustomers(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error("Could not load customers:", error);
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "businessCustomers",
        JSON.stringify(customers)
      );
    } catch (error) {
      console.error("Could not save customers:", error);
    }
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const customerName = String(
        customer.name || ""
      ).toLowerCase();

      const customerEmail = String(
        customer.email || ""
      ).toLowerCase();

      const customerPhone = String(
        customer.phone || ""
      ).toLowerCase();

      const matchesSearch =
        customerName.includes(normalizedSearch) ||
        customerEmail.includes(normalizedSearch) ||
        customerPhone.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "All" ||
        customer.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  const totals = useMemo(() => {
    return customers.reduce(
      (result, customer) => {
        result.totalSpent += Number(customer.totalSpent) || 0;
        result.totalOrders += Number(customer.orders) || 0;

        if (customer.status === "Active") {
          result.active += 1;
        }

        if (customer.status === "New") {
          result.newCustomers += 1;
        }

        return result;
      },
      {
        totalSpent: 0,
        totalOrders: 0,
        active: 0,
        newCustomers: 0,
      }
    );
  }, [customers]);

  function updateStatus(customerId, newStatus) {
    setCustomers((currentCustomers) =>
      currentCustomers.map((customer) =>
        customer.id === customerId
          ? {
              ...customer,
              status: newStatus,
            }
          : customer
      )
    );
  }

  function deleteCustomer(customerId) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this customer?"
    );

    if (!confirmed) {
      return;
    }

    setCustomers((currentCustomers) =>
      currentCustomers.filter(
        (customer) => customer.id !== customerId
      )
    );
  }

  function getCustomerInitials(name) {
    return String(name || "Customer")
      .split(" ")
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  function getStatusClass(status) {
    return `customer-status-${String(status || "new")
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
  }

  return (
    <div className="customers-page">
      <header className="customers-header">
        <div>
          <span>Customer management</span>

          <h1>Customers</h1>

          <p>
            View your customers, track their orders, and
            understand who is buying from your store.
          </p>
        </div>
      </header>

      <section className="customers-summary-grid">
        <article>
          <span>Total customers</span>
          <strong>{customers.length}</strong>
          <p>Customers saved in your store</p>
        </article>

        <article>
          <span>Active customers</span>
          <strong>{totals.active}</strong>
          <p>Customers with recent activity</p>
        </article>

        <article>
          <span>Total orders</span>
          <strong>{totals.totalOrders}</strong>
          <p>Orders across all customers</p>
        </article>

        <article>
          <span>Total customer value</span>
          <strong>{formatCurrency(totals.totalSpent)}</strong>
          <p>Combined customer spending</p>
        </article>
      </section>

      <section className="customers-card">
        <div className="customers-card-heading">
          <div>
            <span>Customer list</span>
            <h2>Your customers</h2>
          </div>

          <strong>{filteredCustomers.length} shown</strong>
        </div>

        <div className="customers-tools">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by name, email, or phone..."
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="All">All statuses</option>
            <option value="New">New</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="customers-empty-state">
            <h3>No customers yet</h3>

            <p>
              Customers will appear here after they place an order.
            </p>
          </div>
        ) : (
          <div className="customers-grid">
            {filteredCustomers.map((customer) => (
              <article
                className="customer-card"
                key={customer.id}
              >
                <div className="customer-card-top">
                  <div className="customer-avatar">
                    {getCustomerInitials(customer.name)}
                  </div>

                  <select
                    className={`customer-status-select ${getStatusClass(
                      customer.status
                    )}`}
                    value={customer.status || "New"}
                    onChange={(event) =>
                      updateStatus(
                        customer.id,
                        event.target.value
                      )
                    }
                  >
                    <option value="New">New</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="customer-main-info">
                  <h3>{customer.name || "Customer"}</h3>
                  <p>{customer.email || "No email"}</p>
                  <p>{customer.phone || "No phone"}</p>
                </div>

                <div className="customer-stats">
                  <div>
                    <span>Orders</span>
                    <strong>{Number(customer.orders) || 0}</strong>
                  </div>

                  <div>
                    <span>Total spent</span>
                    <strong>
                      {formatCurrency(customer.totalSpent)}
                    </strong>
                  </div>

                  <div>
                    <span>Last order</span>
                    <strong>
                      {formatDate(customer.lastOrder)}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="customer-delete-button"
                  onClick={() =>
                    deleteCustomer(customer.id)
                  }
                >
                  Delete customer
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Customers;