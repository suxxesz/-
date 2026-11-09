import { ExternalLink, ArrowUpRight } from 'lucide-react';
import { useCity } from '../store/CityProvider';
import { serviceById } from '../model';
import { PageHeading, InfoStrip, ServiceIcon, Pill, Empty } from '../components/ui';
import { serverMode } from '../api';
export default function Organizations() {
  const { state, open } = useCity(),
    orgs = state.organizations.filter((o) => o.addresses.includes(state.activeAddress));
  return (
    <>
      <PageHeading
        title="Коммунальные организации"
        subtitle="Прозрачная зона ответственности и проверяемый источник информации."
      />
      {!serverMode && (
        <InfoStrip>
          Демонстрационный справочник. Реальные контакты и зоны обслуживания добавляются при
          подключении организаций.
        </InfoStrip>
      )}
      <div className="contacts-grid">
        {orgs.map((o) => (
          <article className="panel contact-card" key={o.id}>
            <div className="card-top">
              <ServiceIcon category={o.categories[0]} />
              <Pill tone={o.connected ? 'success' : 'neutral'}>
                {o.connected ? 'Работает в кабинете' : 'Не подключена'}
              </Pill>
            </div>
            <h3>{o.name}</h3>
            <p>{o.categories.map((c) => serviceById(c).name).join(' · ')}</p>
            <dl>
              <dt>Зона обслуживания</dt>
              <dd>
                {o.addresses.length} {o.addresses.length === 1 ? 'адрес' : 'адреса'} · включая
                выбранный дом
              </dd>
              <dt>Официальный приём показаний</dt>
              <dd>Интеграция не подключена</dd>
            </dl>
            <div className="contact-actions">
              <button
                className="text-link"
                onClick={() => open({ type: 'ticket', category: o.categories[0] })}
              >
                Сохранить обращение
                <ArrowUpRight size={16} />
              </button>
              {o.sourceUrl && (
                <a
                  className="text-link"
                  href={o.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Источник
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
      {!orgs.length && (
        <Empty title="Организации пока не добавлены">
          Администратор должен назначить ответственных за услуги по вашему адресу.
        </Empty>
      )}
    </>
  );
}
